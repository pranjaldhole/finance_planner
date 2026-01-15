// Global variables
let currentResults = null;

function formatCurrency(amount) {
    return new Intl.NumberFormat('de-DE', {
        style: 'currency',
        currency: 'EUR',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(amount);
}

function updateLoanAmount() {
    const propertyPrice = parseFloat(document.getElementById('property_price').value) || 0;
    const ownFunds = parseFloat(document.getElementById('own_funds').value) || 0;
    const loanAmount = Math.max(0, propertyPrice - ownFunds);
    document.getElementById('loan_amount').value = formatCurrency(loanAmount);
}

function calculateFutureValue(initial, monthly, rate, months) {
    const monthlyRate = rate / 12 / 100;
    const futureInitial = initial * Math.pow(1 + monthlyRate, months);
    const futureMonthly = monthly * (Math.pow(1 + monthlyRate, months) - 1) / monthlyRate;
    return futureInitial + futureMonthly;
}

function calculateFutureValueNoInitial(monthly, rate, months) {
    const monthlyRate = rate / 12 / 100;
    return monthly * (Math.pow(1 + monthlyRate, months) - 1) / monthlyRate;
}

function calculatePropertyValue(initial, appreciation, months) {
    const monthlyApp = appreciation / 12 / 100;
    return initial * Math.pow(1 + monthlyApp, months);
}

function calculateLoanBalance(loanAmount, annualInterestRate, monthlyPayment, months) {
    const monthlyRate = annualInterestRate / 12 / 100;
    let balance = loanAmount;
    let month = 1;
    
    while (month <= months && balance > 0) {
        const interestPayment = balance * monthlyRate;
        const principalPayment = Math.min(monthlyPayment - interestPayment, balance);
        balance -= principalPayment;
        month++;
    }
    
    return Math.max(0, balance);
}

function calculateBuyingNetWorth(propValue, loanBalance, etf2Value, divideProperty) {
    const equity = propValue - loanBalance;
    return divideProperty ? (equity / 2) + etf2Value : equity + etf2Value;
}

function findBreakEvenMonths(propertyPrice, investmentCapital, monthlyInvest, etfGains, propertyApp) {
    const monthlyEtfRate = etfGains / 12 / 100;
    const monthlyPropRate = propertyApp / 12 / 100;
    
    // Binary search for the number of months where ETF value >= property value
    let low = 1;
    let high = 1200; // 100 years
    let result = high;
    
    while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        const etfValue = calculateFutureValue(investmentCapital, monthlyInvest, etfGains, mid);
        const propValue = calculatePropertyValue(propertyPrice, propertyApp, mid);
        
        if (etfValue >= propValue) {
            result = mid;
            high = mid - 1;
        } else {
            low = mid + 1;
        }
    }
    
    return result;
}

function calculateComparison(event) {
    event.preventDefault();
    
    const propertyPrice = parseFloat(document.getElementById('property_price').value);
    const ownFunds = parseFloat(document.getElementById('own_funds').value);
    const investmentCapital = parseFloat(document.getElementById('investment_capital').value);
    const loanInterest = parseFloat(document.getElementById('loan_interest').value);
    const monthlyRent = parseFloat(document.getElementById('monthly_rent').value);
    const monthlyEtfInvest = parseFloat(document.getElementById('monthly_etf_invest').value);
    const yearlyEtfGains = parseFloat(document.getElementById('yearly_etf_gains').value);
    const propertyAppreciation = parseFloat(document.getElementById('property_appreciation').value);
    const divideProperty = document.getElementById('divide_property').checked;
    
    // Hide previous error message
    const errorMsgElem = document.getElementById('errorMsg');
    errorMsgElem.classList.add('d-none');
    
    try {
        // Calculate break-even point
        const breakEvenMonths = findBreakEvenMonths(propertyPrice, investmentCapital, monthlyEtfInvest, yearlyEtfGains, propertyAppreciation);
        const breakEvenYears = breakEvenMonths / 12;
        
        // Calculate values at break-even
        const etfValue = calculateFutureValue(investmentCapital, monthlyEtfInvest, yearlyEtfGains, breakEvenMonths);
        const propValue = calculatePropertyValue(propertyPrice, propertyAppreciation, breakEvenMonths);
        
        // Store results
        currentResults = {
            propertyPrice,
            ownFunds,
            investmentCapital,
            loanAmount: propertyPrice - ownFunds,
            loanInterest,
            monthlyRent,
            monthlyEtfInvest,
            yearlyEtfGains,
            propertyAppreciation,
            divideProperty,
            breakEvenMonths,
            breakEvenYears,
            etfValueAtBreakEven: etfValue,
            propValueAtBreakEven: propValue
        };
        
        // Update UI
        updateResults(currentResults);
        
        // Scroll to results
        document.getElementById('resultsContainer').scrollIntoView({
            behavior: 'smooth'
        });
        
        return false;
    } catch (error) {
        errorMsgElem.textContent = 'Error calculating comparison: ' + error.message;
        errorMsgElem.classList.remove('d-none');
        document.getElementById('resultsContainer').style.display = 'none';
        return false;
    }
}

function updateResults(results) {
    // Show results container
    document.getElementById('resultsContainer').style.display = 'block';
    
    // Update input summary
    const inputSummaryList = document.getElementById('inputSummaryList');
    inputSummaryList.innerHTML = `
        <li class="list-group-item">Property Price: ${formatCurrency(results.propertyPrice)}</li>
        <li class="list-group-item">Own Funds (Down Payment): ${formatCurrency(results.ownFunds)}</li>
        <li class="list-group-item">Investment Capital (Initial ETF): ${formatCurrency(results.investmentCapital)}</li>
        <li class="list-group-item">Loan Amount: ${formatCurrency(results.loanAmount)}</li>
        <li class="list-group-item">Loan Interest Rate: ${results.loanInterest.toFixed(2)}%</li>
        <li class="list-group-item">Monthly Rent: ${formatCurrency(results.monthlyRent)}</li>
        <li class="list-group-item">Monthly ETF Investment: ${formatCurrency(results.monthlyEtfInvest)}</li>
        <li class="list-group-item">Yearly ETF Gains: ${results.yearlyEtfGains.toFixed(2)}%</li>
        <li class="list-group-item">Property Appreciation: ${results.propertyAppreciation.toFixed(2)}%</li>
        <li class="list-group-item">Divide Property Amongst Two Owners: ${results.divideProperty ? 'Yes' : 'No'}</li>
    `;
    
    // Update break-even analysis
    const breakEvenList = document.getElementById('breakEvenList');
    breakEvenList.innerHTML = `
        <li class="list-group-item">Break-even Time: ${results.breakEvenYears.toFixed(1)} years (${results.breakEvenMonths} months)</li>
        <li class="list-group-item">ETF Portfolio Value: ${formatCurrency(results.etfValueAtBreakEven)}</li>
        <li class="list-group-item">Property Value: ${formatCurrency(results.propValueAtBreakEven)}</li>
    `;
    
    // Update chart
    updateChart(results);
    
    // Update yearly comparison table
    updateYearlyComparison(results);
}

function updateChart(results) {
    const years = [];
    const etf1Values = []; // with own funds
    const etf2Values = []; // starting from 0
    const propValues = [];
    const buyingNetWorth = [];
    
    const maxYears = Math.ceil(results.breakEvenYears) + 5; // Show 5 years beyond break-even
    
    for (let year = 0; year <= maxYears; year++) {
        const months = year * 12;
        years.push(year);
        const etf1Value = calculateFutureValue(results.investmentCapital, results.monthlyEtfInvest, results.yearlyEtfGains, months);
        etf1Values.push(etf1Value);
        const etf2Value = calculateFutureValueNoInitial(results.monthlyEtfInvest, results.yearlyEtfGains, months);
        etf2Values.push(etf2Value);
        const propValue = calculatePropertyValue(results.propertyPrice, results.propertyAppreciation, months);
        propValues.push(propValue);
        const loanBalance = calculateLoanBalance(results.loanAmount, results.loanInterest, results.monthlyRent, months);
        buyingNetWorth.push(calculateBuyingNetWorth(propValue, loanBalance, etf2Value, results.divideProperty));
    }
    
    const traceEtf1 = {
        x: years,
        y: etf1Values,
        name: 'ETF Portfolio (with Investment Capital)',
        type: 'scatter',
        mode: 'lines',
        line: {
            color: 'rgba(34, 139, 34, 1)',
            width: 2
        }
    };
    
    const traceEtf2 = {
        x: years,
        y: etf2Values,
        name: 'ETF Portfolio (from Scratch)',
        type: 'scatter',
        mode: 'lines',
        line: {
            color: 'rgba(0, 128, 0, 1)',
            width: 2,
            dash: 'dash'
        }
    };
    
    const traceProperty = {
        x: years,
        y: propValues,
        name: 'Property Value',
        type: 'scatter',
        mode: 'lines',
        line: {
            color: 'rgba(30, 144, 255, 1)',
            width: 2
        }
    };
    
    const traceBuyingNetWorth = {
        x: years,
        y: buyingNetWorth,
        name: results.divideProperty ? 'Buying Net Worth ((Property - Loan)/2 + ETF from Scratch)' : 'Buying Net Worth (Property - Loan + ETF from Scratch)',
        type: 'scatter',
        mode: 'lines',
        line: {
            color: 'rgba(255, 69, 0, 1)',
            width: 2
        }
    };
    
    const layout = {
        title: 'Portfolio Value and Net Worth Over Time',
        xaxis: {
            title: 'Years'
        },
        yaxis: {
            title: 'Value (€)',
            tickformat: ',.0f'
        },
        legend: {
            bgcolor: 'rgba(255,255,255,0.7)'
        }
    };
    
    Plotly.newPlot('comparisonChart', [traceEtf1, traceEtf2, traceProperty, traceBuyingNetWorth], layout);
}

function updateYearlyComparison(results) {
    const tbody = document.getElementById('yearlyComparisonBody');
    tbody.innerHTML = '';
    
    const maxYears = Math.ceil(results.breakEvenYears) + 2;
    
    for (let year = 1; year <= maxYears; year++) {
        const months = year * 12;
        const etf1Value = calculateFutureValue(results.investmentCapital, results.monthlyEtfInvest, results.yearlyEtfGains, months);
        const etf2Value = calculateFutureValueNoInitial(results.monthlyEtfInvest, results.yearlyEtfGains, months);
        const propValue = calculatePropertyValue(results.propertyPrice, results.propertyAppreciation, months);
        const loanBalance = calculateLoanBalance(results.loanAmount, results.loanInterest, results.monthlyRent, months);
        const buyingNetWorth = calculateBuyingNetWorth(propValue, loanBalance, etf2Value, results.divideProperty);
        const rentingNetWorth = etf1Value;
        const difference = buyingNetWorth - rentingNetWorth;
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${year}</td>
            <td>${formatCurrency(propValue)}</td>
            <td>${formatCurrency(etf1Value)}</td>
            <td>${formatCurrency(etf2Value)}</td>
            <td>${formatCurrency(buyingNetWorth)}</td>
            <td>${formatCurrency(rentingNetWorth)}</td>
            <td>${formatCurrency(difference)}</td>
        `;
        tbody.appendChild(row);
    }
}

function resetCalculator() {
    document.getElementById('rentBuyForm').reset();
    document.getElementById('resultsContainer').style.display = 'none';
    currentResults = null;
    updateLoanAmount();
}

function generatePDF() {
    if (!currentResults) return;
    
    const pdf = new jspdf.jsPDF();
    
    // Title
    pdf.setFontSize(20);
    pdf.text('Rent vs Buy Comparison Report', 20, 20);
    
    // Input summary
    pdf.setFontSize(14);
    pdf.text('Input Summary', 20, 40);
    pdf.setFontSize(12);
    const inputs = [
        `Property Price: ${formatCurrency(currentResults.propertyPrice)}`,
        `Own Funds (Down Payment): ${formatCurrency(currentResults.ownFunds)}`,
        `Investment Capital (Initial ETF): ${formatCurrency(currentResults.investmentCapital)}`,
        `Loan Amount: ${formatCurrency(currentResults.loanAmount)}`,
        `Loan Interest Rate: ${currentResults.loanInterest.toFixed(2)}%`,
        `Monthly Rent: ${formatCurrency(currentResults.monthlyRent)}`,
        `Monthly ETF Investment: ${formatCurrency(currentResults.monthlyEtfInvest)}`,
        `Yearly ETF Gains: ${currentResults.yearlyEtfGains.toFixed(2)}%`,
        `Property Appreciation: ${currentResults.propertyAppreciation.toFixed(2)}%`,
        '',
        `Break-even Time: ${currentResults.breakEvenYears.toFixed(1)} years`,
        `ETF Value at Break-even: ${formatCurrency(currentResults.etfValueAtBreakEven)}`,
        `Property Value at Break-even: ${formatCurrency(currentResults.propValueAtBreakEven)}`
    ];
    
    let y = 50;
    inputs.forEach(input => {
        pdf.text(input, 20, y);
        y += 10;
    });
    
    // Add chart
    const chartElement = document.getElementById('comparisonChart');
    Plotly.toImage(chartElement, {format: 'png', height: 400, width: 800})
        .then(function(dataUrl) {
            pdf.addPage();
            pdf.addImage(dataUrl, 'PNG', 10, 10, 190, 100);
            
            // Add yearly comparison
            pdf.addPage();
            pdf.setFontSize(14);
            pdf.text('Yearly Comparison', 20, 20);
            
            const yearlyData = [];
            const maxYears = Math.ceil(currentResults.breakEvenYears) + 2;
            
            for (let year = 1; year <= maxYears; year++) {
                const months = year * 12;
                const etf1Value = calculateFutureValue(currentResults.investmentCapital, currentResults.monthlyEtfInvest, currentResults.yearlyEtfGains, months);
                const etf2Value = calculateFutureValueNoInitial(currentResults.monthlyEtfInvest, currentResults.yearlyEtfGains, months);
                const propValue = calculatePropertyValue(currentResults.propertyPrice, currentResults.propertyAppreciation, months);
                const loanBalance = calculateLoanBalance(currentResults.loanAmount, currentResults.loanInterest, currentResults.monthlyRent, months);
                const buyingNetWorth = propValue - loanBalance + etf2Value;
                const rentingNetWorth = etf1Value;
                const difference = buyingNetWorth - rentingNetWorth;
                
                yearlyData.push([
                    year.toString(),
                    formatCurrency(propValue),
                    formatCurrency(etf1Value),
                    formatCurrency(etf2Value),
                    formatCurrency(buyingNetWorth),
                    formatCurrency(rentingNetWorth),
                    formatCurrency(difference)
                ]);
            }
            
            pdf.autoTable({
                head: [['Year', 'Property Value', 'ETF (Investment Capital)', 'ETF (Scratch)', 'Buying Net Worth', 'Renting Net Worth', 'Difference']],
                body: yearlyData,
                startY: 30
            });
            
            // Save the PDF
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            pdf.save(`rent_buy_report_${timestamp}.pdf`);
        });
}