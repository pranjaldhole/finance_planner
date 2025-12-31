// Global variables to store disbursement details for PDF generation
let currentDisbursementDetails = null;

function calculateLoanTerm(loanAmount, annualInterestRate, monthlyPayment) {
    const monthlyRate = annualInterestRate / 12 / 100;
    const term = Math.log(monthlyPayment / (monthlyPayment - loanAmount * monthlyRate)) / Math.log(1 + monthlyRate);
    return Math.ceil(term / 12);
}

function calculateDisbursementLoanPayments(totalLoanAmount, annualInterestRate, monthlyPayment, disbursementSchedule, extra_payment_percentage, fixedPeriodYears = null, includeExtraPayment = false) {
    console.log('calculateDisbursementLoanPayments called with disbursementSchedule:', disbursementSchedule);
    const monthlyRate = annualInterestRate / 12 / 100;
    let balance = 0; // Start with zero balance
    let month = 0; // Start from month 0 for disbursements, payments from month 1
    const schedule = [];
    let totalPayment = 0;
    let totalInterest = 0;
    let fixedPeriodInterest = 0;
    
    // Use extra_payment_percentage of loan amount for annual extra payment
    const annualExtraPayment = includeExtraPayment ? totalLoanAmount * extra_payment_percentage : 0;

    let fixedPeriodRemaining = 0;
    const fixedPeriodMonths = fixedPeriodYears ? fixedPeriodYears * 12 : null;

    // Find the maximum month we need to calculate for
    const maxMonth = Math.max(...disbursementSchedule.map(d => d.month), fixedPeriodMonths || 0);
    const totalMonths = Math.max(maxMonth + 12 * 30, 360); // At least 30 years or max disbursement month + 30 years

    while (month <= totalMonths) {
        // Add disbursements for this month (including month 0)
        const disbursementsThisMonth = disbursementSchedule.filter(d => d.month === month);
        disbursementsThisMonth.forEach(d => {
            balance += d.amount;
        });

        // Only start payments from month 1 onwards
        if (month >= 1) {
            const interestPayment = balance * monthlyRate;
            // Track interest paid during fixed period if specified
            if (fixedPeriodMonths && month <= fixedPeriodMonths) {
                fixedPeriodInterest += interestPayment;
            }
            
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
                remaining_balance: Math.max(0, balance),
                disbursements: disbursementsThisMonth.reduce((sum, d) => sum + d.amount, 0)
            });

            // Record remaining balance at end of fixed period
            if (fixedPeriodMonths && month === fixedPeriodMonths) {
                fixedPeriodRemaining = balance;
            }

            // Stop if balance is paid off
            if (balance <= 0.01) {
                break;
            }
        } else {
            // For months before payments start (month 0), just record disbursements
            schedule.push({
                month,
                principal_payment: 0,
                interest_payment: 0,
                extra_payment: 0,
                remaining_balance: balance,
                disbursements: disbursementsThisMonth.reduce((sum, d) => sum + d.amount, 0)
            });
        }

        month++;
    }

    return {
        total_loan_amount: totalLoanAmount,
        annual_interest_rate: annualInterestRate,
        monthly_payment: monthlyPayment,
        amortization_schedule: schedule,
        total_payment: totalPayment,
        total_interest: totalInterest,
        annual_extra_payment: annualExtraPayment,
        fixed_period_years: fixedPeriodYears,
        fixed_period_remaining: fixedPeriodMonths ? fixedPeriodRemaining : 0,
        fixed_period_interest: fixedPeriodMonths ? fixedPeriodInterest : 0,
        disbursement_schedule: disbursementSchedule
    };
    console.log('calculateDisbursementLoanPayments returning object with amortization_schedule length:', schedule.length);
}

function updateResults(disbursementDetails) {
    console.log('updateResults called with disbursementDetails:', disbursementDetails);
    // Store disbursement details for PDF generation
    currentDisbursementDetails = disbursementDetails;

    // Check if disbursementDetails is valid
    if (!disbursementDetails || !disbursementDetails.disbursement_schedule || !disbursementDetails.amortization_schedule) {
        console.error('Invalid disbursementDetails:', disbursementDetails);
        alert('Error: Invalid calculation results. Please check your input data.');
        return;
    }

    // Show results container
    document.getElementById('resultsContainer').style.display = 'block';

    // Update loan summary
    const loanSummaryList = document.getElementById('loanSummaryList');
    loanSummaryList.innerHTML = `
        <li class="list-group-item">Total Loan Amount: ${formatCurrency(disbursementDetails.total_loan_amount)}</li>
        <li class="list-group-item">Annual Interest Rate: ${disbursementDetails.annual_interest_rate.toFixed(2)}%</li>
        <li class="list-group-item">Monthly Payment (EMI): ${formatCurrency(disbursementDetails.monthly_payment)}</li>
        <li class="list-group-item">Original Term: ${Math.ceil(disbursementDetails.amortization_schedule.filter(p => p.principal_payment > 0).length / 12)} years</li>
        <li class="list-group-item">Actual Term: ${Math.ceil(disbursementDetails.amortization_schedule.filter(p => p.principal_payment > 0).length / 12)} years</li>
        ${disbursementDetails.fixed_period_years ? `<li class="list-group-item">Fixed Interest Period: ${disbursementDetails.fixed_period_years} years</li>` : ''}
    `;

    // Update phase overview
    const phaseOverviewList = document.getElementById('phaseOverviewList');
    const totalDisbursed = disbursementDetails.disbursement_schedule.reduce((sum, phase) => sum + phase.amount, 0);
    const totalPhases = disbursementDetails.disbursement_schedule.length;

    phaseOverviewList.innerHTML = `
        <li class="list-group-item">Total Disbursements: ${formatCurrency(totalDisbursed)}</li>
        <li class="list-group-item">Number of Phases: ${totalPhases}</li>
        <li class="list-group-item">Total Payment: ${formatCurrency(disbursementDetails.total_payment)}</li>
        <li class="list-group-item">Total Interest: ${formatCurrency(disbursementDetails.total_interest)}</li>
        ${disbursementDetails.annual_extra_payment > 0 ? `<li class="list-group-item">Annual Extra Payment: ${formatCurrency(disbursementDetails.annual_extra_payment)}</li>` : ''}
        ${disbursementDetails.fixed_period_years ? `<li class="list-group-item">Remaining After Fixed Period: ${formatCurrency(disbursementDetails.fixed_period_remaining + disbursementDetails.annual_extra_payment)}</li>` : ''}
        ${disbursementDetails.fixed_period_interest ? `<li class="list-group-item">Interest Paid During Fixed Period: ${formatCurrency(disbursementDetails.fixed_period_interest)}</li>` : ''}
    `;

    // Create the disbursement chart
    createDisbursementChart(disbursementDetails);

    // Update phase details table
    updatePhaseDetails(disbursementDetails);

    // Update monthly schedule
    updateMonthlySchedule(disbursementDetails);

    // Update yearly summary
    updateYearlySummary(disbursementDetails);
}

function createDisbursementChart(disbursementDetails) {
    const months = [];
    const disbursements = [];
    const balances = [];
    const cumulativePrincipal = [];
    const cumulativeInterest = [];

    let totalPrincipal = 0;
    let totalInterest = 0;

    disbursementDetails.amortization_schedule.forEach(payment => {
        months.push(payment.month);
        disbursements.push(payment.disbursements);
        balances.push(payment.remaining_balance);

        totalPrincipal += payment.principal_payment;
        totalInterest += payment.interest_payment;

        cumulativePrincipal.push(totalPrincipal);
        cumulativeInterest.push(totalInterest);
    });

    const traceDisbursements = {
        x: months,
        y: disbursements,
        name: 'Monthly Disbursements',
        type: 'bar',
        marker: { color: 'rgba(75, 192, 192, 0.6)' }
    };

    const tracePrincipal = {
        x: months,
        y: cumulativePrincipal,
        name: 'Principal Paid',
        type: 'scatter',
        mode: 'lines',
        line: { color: 'rgba(34, 139, 34, 1)', width: 2 },
        yaxis: 'y2'
    };

    const traceInterest = {
        x: months,
        y: cumulativeInterest,
        name: 'Interest Paid',
        type: 'scatter',
        mode: 'lines',
        line: { color: 'rgba(220, 20, 60, 1)', width: 2 },
        yaxis: 'y2'
    };

    const traceBalance = {
        x: months,
        y: balances,
        name: 'Outstanding Balance',
        type: 'scatter',
        mode: 'lines',
        line: { color: 'rgba(30, 144, 255, 1)', width: 3 },
        yaxis: 'y2'
    };

    const layout = {
        title: 'Disbursement Timeline and Loan Progress',
        xaxis: { title: 'Month' },
        yaxis: { title: 'Disbursement Amount (€)', tickformat: ',.0f' },
        yaxis2: {
            title: 'Balance/Principal (€)',
            overlaying: 'y',
            side: 'right',
            tickformat: ',.0f'
        },
        legend: { bgcolor: 'rgba(255,255,255,0.7)' }
    };

    Plotly.newPlot('disbursementChart', [traceDisbursements, tracePrincipal, traceInterest, traceBalance], layout);
}

function updatePhaseDetails(disbursementDetails) {
    const tbody = document.getElementById('phaseDetailsBody');
    tbody.innerHTML = '';

    disbursementDetails.disbursement_schedule.forEach(phase => {
        tbody.innerHTML += `
            <tr>
                <td>${phase.phase}</td>
                <td>${phase.month}</td>
                <td>${formatCurrency(phase.amount)}</td>
                <td colspan="2">Disbursement Phase</td>
            </tr>
        `;
    });
}

function updateMonthlySchedule(disbursementDetails) {
    console.log('updateMonthlySchedule called with', disbursementDetails.amortization_schedule.length, 'payments');
    const tbody = document.getElementById('monthlyScheduleBody');
    console.log('monthlyScheduleBody element:', tbody);
    if (!tbody) {
        console.error('monthlyScheduleBody element not found');
        return;
    }
    let rows = '';

    disbursementDetails.amortization_schedule.forEach(payment => {
        rows += `
            <tr ${payment.month % 12 === 0 ? 'class="table-info"' : ''}>
                <td>${payment.month}</td>
                <td>${formatCurrency(payment.principal_payment + payment.interest_payment)}</td>
                <td>${formatCurrency(payment.principal_payment)}</td>
                <td>${formatCurrency(payment.interest_payment)}</td>
                <td>${formatCurrency(payment.remaining_balance)}</td>
                <td>${formatCurrency(payment.disbursements)}</td>
            </tr>
        `;
    });
    
    tbody.innerHTML = rows;
    console.log('updateMonthlySchedule completed, tbody has', tbody.children.length, 'rows');
}

function updateYearlySummary(disbursementDetails) {
    console.log('updateYearlySummary called with', disbursementDetails.amortization_schedule.length, 'payments');
    const yearlyTotals = {};
    const tbody = document.getElementById('yearlySummaryBody');
    console.log('yearlySummaryBody element:', tbody);
    if (!tbody) {
        console.error('yearlySummaryBody element not found');
        return;
    }
    let rows = '';

    disbursementDetails.amortization_schedule.forEach(payment => {
        const year = Math.floor((payment.month - 1) / 12) + 1;
        if (!yearlyTotals[year]) {
            yearlyTotals[year] = {
                principal: 0,
                interest: 0,
                balance: 0,
                disbursements: 0
            };
        }
        yearlyTotals[year].principal += payment.principal_payment;
        yearlyTotals[year].interest += payment.interest_payment;
        yearlyTotals[year].disbursements += payment.disbursements;
        yearlyTotals[year].balance = payment.remaining_balance;

        if (payment.month % 12 === 0 || payment.month === disbursementDetails.amortization_schedule.length - 1) {
            rows += `
                <tr>
                    <td>Year ${year}</td>
                    <td>${formatCurrency(yearlyTotals[year].principal)}</td>
                    <td>${formatCurrency(yearlyTotals[year].interest)}</td>
                    <td>${formatCurrency(yearlyTotals[year].balance)}</td>
                    <td>${formatCurrency(yearlyTotals[year].disbursements)}</td>
                </tr>
            `;
        }
    });
    
    tbody.innerHTML = rows;
    console.log('updateYearlySummary completed, tbody has', tbody.children.length, 'rows');
}

function formatCurrency(amount) {
    return new Intl.NumberFormat('de-DE', {
        style: 'currency',
        currency: 'EUR',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(amount);
}

function calculateDisbursement(event) {
    event.preventDefault();

    const totalLoanAmount = parseFloat(document.getElementById('total_loan_amount').value);
    const annualInterestRate = parseFloat(document.getElementById('annual_interest_rate').value);
    const monthlyPayment = parseFloat(document.getElementById('monthly_payment').value);
    const includeExtra = document.getElementById('include_extra').checked;
    const fixedPeriod = document.getElementById('fixed_period').value;
    const fixedPeriodYears = fixedPeriod ? parseInt(fixedPeriod) : null;
    const extra_payment_percentage = includeExtra ? (parseFloat(document.getElementById('extra_payment_percentage').value) / 100) : 0;

    // Hide previous error message
    const errorMsgElem = document.getElementById('disbursementErrorMsg');
    errorMsgElem.classList.add('d-none');

    try {
        // Calculate loan term first to check for errors
        let loanTermYears;
        try {
            loanTermYears = calculateLoanTerm(totalLoanAmount, annualInterestRate, monthlyPayment);
        } catch (e) {
            errorMsgElem.textContent = 'Monthly payment is too low. The loan would never be paid off. Please enter a higher monthly payment.';
            errorMsgElem.classList.remove('d-none');
            document.getElementById('monthly_payment').focus();
            return false;
        }

        // Collect phase data
        const phases = [];
        const phaseNames = ['Land Purchase', 'Foundation', 'Shell', 'Roof', 'Interior Work'];

        for (let i = 1; i <= 5; i++) {
            const month = parseInt(document.getElementById(`phase_${i}_delay`).value) || 0;
            const amount = parseFloat(document.getElementById(`phase_${i}_amount`).value) || 0;

            if (amount > 0) {
                phases.push({
                    phase: phaseNames[i-1],
                    month: month,
                    amount: amount
                });
            }
        }

        // Validate that we have at least one phase
        if (phases.length === 0) {
            const errorMsgElem = document.getElementById('disbursementErrorMsg');
            errorMsgElem.textContent = 'Please enter at least one disbursement phase with a positive amount.';
            errorMsgElem.classList.remove('d-none');
            return false;
        }

        // Validate total disbursements match loan amount
        const totalDisbursed = phases.reduce((sum, phase) => sum + phase.amount, 0);
        if (Math.abs(totalDisbursed - totalLoanAmount) > 0.01) {
            const errorMsgElem = document.getElementById('disbursementErrorMsg');
            errorMsgElem.textContent = `Total disbursements (${formatCurrency(totalDisbursed)}) must equal total loan amount (${formatCurrency(totalLoanAmount)})`;
            errorMsgElem.classList.remove('d-none');
            return false;
        }

        // Calculate disbursement schedule
        const disbursementSchedule = phases;
        console.log('phases:', phases);
        console.log('disbursementSchedule:', disbursementSchedule);

        // Calculate loan details
        const disbursementDetails = calculateDisbursementLoanPayments(
            totalLoanAmount,
            annualInterestRate,
            monthlyPayment,
            disbursementSchedule,
            extra_payment_percentage,
            fixedPeriodYears,
            includeExtra
        );

        disbursementDetails.original_term_months = loanTermYears * 12;

        // If loan term is extremely long (e.g. > 50 years), show warning
        if (loanTermYears > 50) {
            errorMsgElem.textContent = 'Warning: The monthly payment is very low. The loan term exceeds 50 years.';
            errorMsgElem.classList.remove('d-none');
        } else {
            errorMsgElem.classList.add('d-none');
        }

        // Update the results
        updateResults(disbursementDetails);

        // Scroll to results
        document.getElementById('resultsContainer').scrollIntoView({
            behavior: 'smooth'
        });

        return false;
    } catch (error) {
        const errorMsgElem = document.getElementById('disbursementErrorMsg');
        errorMsgElem.textContent = 'Error calculating disbursement: ' + error.message;
        errorMsgElem.classList.remove('d-none');
        return false;
    }
}

function resetCalculator() {
    document.getElementById('disbursementForm').reset();
    document.getElementById('resultsContainer').style.display = 'none';
    currentDisbursementDetails = null;
}

function generatePDF() {
    if (!currentDisbursementDetails) {
        alert('Please calculate disbursement details first');
        return;
    }

    // Create PDF
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF();

    // Title
    pdf.setFontSize(16);
    pdf.text('Loan Disbursement Calculator Report', pdf.internal.pageSize.width / 2, 20, { align: 'center' });

    // Add timestamp
    pdf.setFontSize(10);
    pdf.text(`Generated on: ${new Date().toLocaleString()}`, 20, 30);

    // Loan Summary
    pdf.setFontSize(14);
    pdf.text('Loan Summary', 20, 40);
    pdf.setFontSize(12);

    const details = [
        `Total Loan Amount: ${formatCurrency(currentDisbursementDetails.total_loan_amount)}`,
        `Annual Interest Rate: ${currentDisbursementDetails.annual_interest_rate.toFixed(2)}%`,
        `Monthly Payment (EMI): ${formatCurrency(currentDisbursementDetails.monthly_payment)}`,
        `Original Loan Term: ${Math.ceil(currentDisbursementDetails.original_term_months/12)} years`,
        `Actual Loan Term: ${Math.ceil(currentDisbursementDetails.amortization_schedule.filter(p => p.principal_payment > 0).length / 12)} years`,
        `Total of Payments: ${formatCurrency(currentDisbursementDetails.total_payment)}`,
        `Total Interest: ${formatCurrency(currentDisbursementDetails.total_interest)}`
    ].filter(Boolean);

    if (currentDisbursementDetails.annual_extra_payment > 0) {
        details.push(`Annual Extra Payment: ${formatCurrency(currentDisbursementDetails.annual_extra_payment)}`);
    }
    if (currentDisbursementDetails.fixed_period_years) {
        details.push(`Remaining After Fixed Period: ${formatCurrency(currentDisbursementDetails.fixed_period_remaining)}`);
        if (currentDisbursementDetails.fixed_period_interest) {
            details.push(`Interest Paid During Fixed Period: ${formatCurrency(currentDisbursementDetails.fixed_period_interest)}`);
        }
    }

    let y = 50;
    details.forEach(detail => {
        pdf.text(detail, 20, y);
        y += 10;
    });

    // Phase Details
    pdf.addPage();
    pdf.setFontSize(14);
    pdf.text('Disbursement Phases', 20, 20);

    const phaseData = currentDisbursementDetails.disbursement_schedule.map(phase => ([
        phase.phase,
        phase.month,
        formatCurrency(phase.amount)
    ]));

    pdf.autoTable({
        head: [['Phase', 'Month', 'Amount']],
        body: phaseData,
        startY: 30
    });

    // Monthly Schedule
    pdf.addPage();
    pdf.setFontSize(14);
    pdf.text('Monthly Payment Schedule', 20, 20);

    const monthlyData = currentDisbursementDetails.amortization_schedule.map(payment => ([
        payment.month,
        formatCurrency(payment.principal_payment + payment.interest_payment),
        formatCurrency(payment.principal_payment),
        formatCurrency(payment.interest_payment),
        formatCurrency(payment.remaining_balance),
        formatCurrency(payment.disbursements)
    ]));

    pdf.autoTable({
        head: [['Month', 'EMI', 'Principal', 'Interest', 'Balance', 'Disbursements']],
        body: monthlyData,
        startY: 30,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [22, 160, 133] },
        alternateRowStyles: { fillColor: [238, 238, 238] }
    });

    // Yearly Summary
    pdf.addPage();
    pdf.setFontSize(14);
    pdf.text('Yearly Summary', 20, 20);

    const yearlyData = [];
    const yearlyTotals = {};

    currentDisbursementDetails.amortization_schedule.forEach(payment => {
        const year = Math.floor((payment.month - 1) / 12) + 1;
        if (!yearlyTotals[year]) {
            yearlyTotals[year] = {
                principal: 0,
                interest: 0,
                balance: 0,
                disbursements: 0
            };
        }
        yearlyTotals[year].principal += payment.principal_payment;
        yearlyTotals[year].interest += payment.interest_payment;
        yearlyTotals[year].disbursements += payment.disbursements;
        yearlyTotals[year].balance = payment.remaining_balance;

        if (payment.month % 12 === 0 || payment.month === currentDisbursementDetails.amortization_schedule.length - 1) {
            yearlyData.push([
                `Year ${year}`,
                formatCurrency(yearlyTotals[year].principal),
                formatCurrency(yearlyTotals[year].interest),
                formatCurrency(yearlyTotals[year].balance),
                formatCurrency(yearlyTotals[year].disbursements)
            ]);
        }
    });

    pdf.autoTable({
        head: [['Year', 'Principal Paid', 'Interest Paid', 'Year-End Balance', 'Disbursements']],
        body: yearlyData,
        startY: 30
    });

    // Save the PDF
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    pdf.save(`disbursement_report_${Math.floor(currentDisbursementDetails.totalLoanAmount)}_${timestamp}.pdf`);
}