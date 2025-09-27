// Global variables to store loan details for PDF generation
let currentLoanDetails = null;

function calculateLoanTerm(loanAmount, annualInterestRate, monthlyPayment) {
    const monthlyRate = annualInterestRate / 12 / 100;
    const term = Math.log(monthlyPayment / (monthlyPayment - loanAmount * monthlyRate)) / Math.log(1 + monthlyRate);
    return Math.ceil(term / 12);
}

function calculateLoanPayments(loanAmount, annualInterestRate, monthlyPayment, fixedPeriodYears = null, includeExtraPayment = false) {
    const monthlyRate = annualInterestRate / 12 / 100;
    let balance = loanAmount;
    let month = 1;
    const schedule = [];
    let totalPayment = 0;
    let totalInterest = 0;
    // Use 5% of loan amount for annual extra payment, matching Python
    const annualExtraPayment = includeExtraPayment ? loanAmount * 0.05 : 0;

    let fixedPeriodRemaining = 0;
    const fixedPeriodMonths = fixedPeriodYears ? fixedPeriodYears * 12 : null;

    while (balance > 0) {
        const interestPayment = balance * monthlyRate;
        let principalPayment = monthlyPayment - interestPayment;
        let extraPayment = 0;

        // Add extra payment in December if enabled
        if (includeExtraPayment && month % 12 === 0 && balance > 0) {
            // Only pay up to remaining balance
            extraPayment = Math.min(annualExtraPayment, balance - principalPayment);
            principalPayment += extraPayment;
        }

        // Adjust final payment if it would overpay
        if (principalPayment > balance) {
            principalPayment = balance;
            if (extraPayment > 0) {
                extraPayment = Math.max(0, principalPayment - (monthlyPayment - interestPayment));
            }
        }

        balance -= principalPayment;
        totalPayment += principalPayment + interestPayment;
        totalInterest += interestPayment;

        schedule.push({
            month,
            principal_payment: principalPayment,
            interest_payment: interestPayment,
            extra_payment: extraPayment,
            remaining_balance: balance
        });

        // Record remaining balance at end of fixed period, but do not break loop
        if (fixedPeriodMonths && month === fixedPeriodMonths) {
            fixedPeriodRemaining = balance;
        }

        month++;
    }

    return {
        loan_amount: loanAmount,
        annual_interest_rate: annualInterestRate,
        monthly_payment: monthlyPayment,
        amortization_schedule: schedule,
        total_payment: totalPayment,
        total_interest: totalInterest,
        annual_extra_payment: annualExtraPayment,
        fixed_period_years: fixedPeriodYears,
        fixed_period_remaining: fixedPeriodMonths ? fixedPeriodRemaining : 0
    };
}

function updateResults(loanDetails) {
    // Store loan details for PDF generation
    currentLoanDetails = loanDetails;
    
    // Show results container
    document.getElementById('resultsContainer').style.display = 'block';

    // Update loan details
    const loanDetailsList = document.getElementById('loanDetailsList');
    loanDetailsList.innerHTML = `
        <li class="list-group-item">Property Value: ${formatCurrency(document.getElementById('property_value').value)}</li>
        <li class="list-group-item">Own Funds: ${formatCurrency(document.getElementById('own_funds').value)}</li>
        <li class="list-group-item">Loan Amount: ${formatCurrency(loanDetails.loan_amount)}</li>
        <li class="list-group-item">Annual Interest Rate: ${loanDetails.annual_interest_rate.toFixed(2)}%</li>
        <li class="list-group-item">Monthly Payment: ${formatCurrency(loanDetails.monthly_payment)}</li>
        <li class="list-group-item">Original Term: ${(loanDetails.original_term_months/12).toFixed(1)} years</li>
        <li class="list-group-item">Actual Term: ${(loanDetails.amortization_schedule.length/12).toFixed(1)} years</li>
    `;

    // Update payment summary
    const paymentSummaryList = document.getElementById('paymentSummaryList');
    paymentSummaryList.innerHTML = `
        <li class="list-group-item">Total Payment: ${formatCurrency(loanDetails.total_payment)}</li>
        <li class="list-group-item">Total Interest: ${formatCurrency(loanDetails.total_interest)}</li>
        ${loanDetails.annual_extra_payment > 0 ? `<li class="list-group-item">Annual Extra Payment: ${formatCurrency(loanDetails.annual_extra_payment)}</li>` : ''}
        ${loanDetails.fixed_period_years ? `<li class="list-group-item">Remaining After Fixed Period: ${formatCurrency(loanDetails.fixed_period_remaining)}</li>` : ''}
    `;

    // Create the amortization chart
    createAmortizationChart(loanDetails);

    // Update yearly summary
    updateYearlySummary(loanDetails);

    // Update monthly schedule
    updateMonthlySchedule(loanDetails);
}

function createAmortizationChart(loanDetails) {
    const months = [];
    const balances = [];
    const cumulativePrincipal = [];
    const cumulativeInterest = [];
    
    let totalPrincipal = 0;
    let totalInterest = 0;
    
    loanDetails.amortization_schedule.forEach(payment => {
        months.push(payment.month);
        balances.push(payment.remaining_balance);
        
        totalPrincipal += payment.principal_payment;
        totalInterest += payment.interest_payment;
        
        cumulativePrincipal.push(totalPrincipal);
        cumulativeInterest.push(totalInterest);
    });

    const tracePrincipal = {
        x: months,
        y: cumulativePrincipal,
        name: 'Principal Paid',
        type: 'scatter',
        fill: 'tozeroy',
        mode: 'lines',
        line: {
            color: 'rgba(34, 139, 34, 1)', // solid green
            width: 2
        },
        fillcolor: 'rgba(34, 139, 34, 0.2)' // semi-transparent green
    };

    const traceInterest = {
        x: months,
        y: cumulativeInterest,
        name: 'Interest Paid',
        type: 'scatter',
        fill: 'tozeroy',
        mode: 'lines',
        line: {
            color: 'rgba(220, 20, 60, 1)', // solid red
            width: 2
        },
        fillcolor: 'rgba(220, 20, 60, 0.2)' // semi-transparent red
    };

    const traceBalance = {
        x: months,
        y: balances,
        name: 'Remaining Balance',
        type: 'scatter',
        mode: 'lines',
        line: {
            color: 'rgba(30, 144, 255, 1)', // solid blue
            width: 3
        }
    };

    const layout = {
        title: 'Loan Amortization Over Time',
        xaxis: {
            title: 'Month'
        },
        yaxis: {
            title: 'Amount (€)',
            tickformat: ',.0f'
        },
        legend: {
            bgcolor: 'rgba(255,255,255,0.7)'
        }
    };

    Plotly.newPlot('amortizationChart', [tracePrincipal, traceInterest, traceBalance], layout);
}

function updateYearlySummary(loanDetails) {
    const yearlyTotals = {};
    const tbody = document.getElementById('yearlySummaryBody');
    tbody.innerHTML = '';

    loanDetails.amortization_schedule.forEach(payment => {
        const year = Math.floor((payment.month - 1) / 12) + 1;
        if (!yearlyTotals[year]) {
            yearlyTotals[year] = {
                principal: 0,
                interest: 0,
                balance: 0
            };
        }
        yearlyTotals[year].principal += payment.principal_payment;
        yearlyTotals[year].interest += payment.interest_payment;
        yearlyTotals[year].balance = payment.remaining_balance;

        if (payment.month % 12 === 0 || payment.month === loanDetails.amortization_schedule.length) {
            tbody.innerHTML += `
                <tr>
                    <td>Year ${year}</td>
                    <td>${formatCurrency(yearlyTotals[year].principal)}</td>
                    <td>${formatCurrency(yearlyTotals[year].interest)}</td>
                    <td>${formatCurrency(yearlyTotals[year].balance)}</td>
                </tr>
            `;
        }
    });
}

function updateMonthlySchedule(loanDetails) {
    const tbody = document.getElementById('monthlyScheduleBody');
    tbody.innerHTML = '';

    loanDetails.amortization_schedule.forEach(payment => {
        tbody.innerHTML += `
            <tr ${payment.month % 12 === 0 ? 'class="table-info"' : ''}>
                <td>${payment.month}</td>
                <td>${formatCurrency(payment.principal_payment)}</td>
                <td>${formatCurrency(payment.interest_payment)}</td>
                <td>${formatCurrency(payment.remaining_balance)}</td>
                <td>${formatCurrency(payment.extra_payment)}</td>
            </tr>
        `;
    });
}

function formatCurrency(amount) {
    return new Intl.NumberFormat('de-DE', {
        style: 'currency',
        currency: 'EUR',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(amount);
}

function calculateLoanAmount() {
    const propertyValue = parseFloat(document.getElementById('property_value').value) || 0;
    const ownFunds = parseFloat(document.getElementById('own_funds').value) || 0;
    const loanAmount = Math.max(0, propertyValue - ownFunds);
    
    // Update the display field with formatted currency
    document.getElementById('loan_amount').value = formatCurrency(loanAmount);
    return loanAmount;
}

function calculateLoan(event) {
    event.preventDefault();
    
    const propertyValue = parseFloat(document.getElementById('property_value').value);
    const ownFunds = parseFloat(document.getElementById('own_funds').value);
    const loanAmount = calculateLoanAmount();

    if (loanAmount <= 0) {
        alert('Invalid loan amount. Own funds cannot exceed or equal property value.');
        return false;
    }

    const annualInterestRate = parseFloat(document.getElementById('annual_interest_rate').value);
    const monthlyPayment = parseFloat(document.getElementById('monthly_payment').value);
    const includeExtra = document.getElementById('include_extra').checked;
    const fixedPeriod = document.getElementById('fixed_period').value;
    const fixedPeriodYears = fixedPeriod ? parseInt(fixedPeriod) : null;

    // Hide previous error message
    const errorMsgElem = document.getElementById('loanErrorMsg');
    errorMsgElem.classList.add('d-none');
    errorMsgElem.textContent = '';

    try {
        // Calculate loan term first to check for errors
        let loanTermYears;
        try {
            loanTermYears = calculateLoanTerm(loanAmount, annualInterestRate, monthlyPayment);
        } catch (e) {
            errorMsgElem.textContent = 'Monthly payment is too low. The loan would never be paid off.';
            errorMsgElem.classList.remove('d-none');
            return false;
        }

        // Calculate loan details
        const loanDetails = calculateLoanPayments(
            loanAmount,
            annualInterestRate,
            monthlyPayment,
            fixedPeriodYears,
            includeExtra
        );

        loanDetails.original_term_months = loanTermYears * 12;

        // If loan term is extremely long (e.g. > 50 years), show warning
        if (loanTermYears > 50) {
            errorMsgElem.textContent = 'Warning: The monthly payment is very low. The loan term exceeds 50 years.';
            errorMsgElem.classList.remove('d-none');
        }

        // Update the results
        updateResults(loanDetails);
        
        // Scroll to results
        document.getElementById('resultsContainer').scrollIntoView({
            behavior: 'smooth'
        });
        
        return false;
    } catch (error) {
        errorMsgElem.textContent = 'Error calculating loan: ' + error.message;
        errorMsgElem.classList.remove('d-none');
        return false;
    }
}

function resetCalculator() {
    document.getElementById('loanForm').reset();
    document.getElementById('resultsContainer').style.display = 'none';
    currentLoanDetails = null;
    calculateLoanAmount(); // Reset the loan amount display
}

// Add event listeners for property value and own funds inputs
document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('property_value').addEventListener('input', calculateLoanAmount);
    document.getElementById('own_funds').addEventListener('input', calculateLoanAmount);
    calculateLoanAmount(); // Calculate initial loan amount
});

function generatePDF() {
    if (!currentLoanDetails) {
        alert('Please calculate loan details first');
        return;
    }

    // Create PDF
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF();
    
    // Title
    pdf.setFontSize(16);
    pdf.text('Loan Calculator Report', pdf.internal.pageSize.width / 2, 20, { align: 'center' });
    
    // Add timestamp
    pdf.setFontSize(10);
    pdf.text(`Generated on: ${new Date().toLocaleString()}`, 20, 30);

    // Loan Summary
    pdf.setFontSize(14);
    pdf.text('Loan Summary', 20, 40);
    pdf.setFontSize(12);
    
    // Get monthly salary from the form if present
    let monthlySalary = '';
    const salaryElem = document.getElementById('monthly_salary');
    if (salaryElem) {
        monthlySalary = salaryElem.value ? formatCurrency(salaryElem.value) : '';
    }

    const details = [
        `Property Value: ${formatCurrency(document.getElementById('property_value').value)}`,
        `Own Funds: ${formatCurrency(document.getElementById('own_funds').value)}`,
        `Loan Amount: ${formatCurrency(currentLoanDetails.loan_amount)}`,
        `Annual Interest Rate: ${currentLoanDetails.annual_interest_rate.toFixed(2)}%`,
        `Monthly Payment: ${formatCurrency(currentLoanDetails.monthly_payment)}`,
        monthlySalary ? `Monthly Salary: ${monthlySalary}` : '',
        `Original Loan Term: ${(currentLoanDetails.original_term_months/12).toFixed(1)} years`,
        `Actual Loan Term: ${(currentLoanDetails.amortization_schedule.length/12).toFixed(1)} years`,
        `Total of Payments: ${formatCurrency(currentLoanDetails.total_payment)}`,
        `Total Interest: ${formatCurrency(currentLoanDetails.total_interest)}`
    ].filter(Boolean);

    if (currentLoanDetails.annual_extra_payment > 0) {
        details.push(`Annual Extra Payment: ${formatCurrency(currentLoanDetails.annual_extra_payment)}`);
    }
    if (currentLoanDetails.fixed_period_years) {
        details.push(`Remaining After Fixed Period: ${formatCurrency(currentLoanDetails.fixed_period_remaining)}`);
    }

    let y = 50;
    details.forEach(detail => {
        pdf.text(detail, 20, y);
        y += 10;
    });

    // Add chart
    const chartElement = document.getElementById('amortizationChart');
    Plotly.toImage(chartElement, {format: 'png', height: 400, width: 800})
        .then(function(dataUrl) {
            pdf.addPage();
            pdf.addImage(dataUrl, 'PNG', 10, 10, 190, 100);
            
            // Add yearly summary
            pdf.addPage();
            pdf.setFontSize(14);
            pdf.text('Yearly Summary', 20, 20);
            
            // Create yearly summary table
            const yearlyData = [];
            const yearlyTotals = {};
            
            currentLoanDetails.amortization_schedule.forEach(payment => {
                const year = Math.floor((payment.month - 1) / 12) + 1;
                if (!yearlyTotals[year]) {
                    yearlyTotals[year] = {
                        principal: 0,
                        interest: 0,
                        balance: 0
                    };
                }
                yearlyTotals[year].principal += payment.principal_payment;
                yearlyTotals[year].interest += payment.interest_payment;
                yearlyTotals[year].balance = payment.remaining_balance;

                if (payment.month % 12 === 0 || payment.month === currentLoanDetails.amortization_schedule.length) {
                    yearlyData.push([
                        `Year ${year}`,
                        formatCurrency(yearlyTotals[year].principal),
                        formatCurrency(yearlyTotals[year].interest),
                        formatCurrency(yearlyTotals[year].balance)
                    ]);
                }
            });

            pdf.autoTable({
                head: [['Year', 'Principal Paid', 'Interest Paid', 'Year-End Balance']],
                body: yearlyData,
                startY: 30
            });

            // Add monthly schedule
            pdf.addPage();
            pdf.setFontSize(14);
            pdf.text('Monthly Amortization Schedule', 20, 20);

            const monthlyData = currentLoanDetails.amortization_schedule.map(payment => ([
                payment.month,
                formatCurrency(payment.principal_payment),
                formatCurrency(payment.interest_payment),
                formatCurrency(payment.remaining_balance),
                formatCurrency(payment.extra_payment)
            ]));

            pdf.autoTable({
                head: [['Month', 'Principal Payment', 'Interest Payment', 'Remaining Balance', 'Extra Payment']],
                body: monthlyData,
                startY: 30,
                styles: { fontSize: 8 },
                headStyles: { fillColor: [22, 160, 133] },
                alternateRowStyles: { fillColor: [238, 238, 238] }
            });

            // Save the PDF
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            pdf.save(`loan_report_${Math.floor(currentLoanDetails.loan_amount)}_${timestamp}.pdf`);
        });
}