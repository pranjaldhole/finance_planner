import matplotlib.pyplot as plt
import numpy as np
from fpdf import FPDF
from datetime import datetime
import os


class LoanPDF(FPDF):
    def __init__(self):
        super().__init__(format='A4')
        self.set_font('helvetica', '')

    def cell(self, w, h, txt, border=0, ln=0, align='', fill=False):
        # Make sure we're always using strings
        txt = str(txt)
        # Replace euro symbol with EUR
        txt = txt.replace('€', 'EUR')
        super().cell(w, h, txt, border, ln, align, fill)

    def formatted_cell(self, w, h, txt, border=0, ln=0, align='', fill=False):
        self.cell(w, h, txt, border, ln, align, fill)


def save_to_pdf(loan_details, plot_path):
    """Save loan details and plot to a PDF file."""
    # Create PDF with A4 format and UTF-8 support
    pdf = LoanPDF()
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.add_page()

    # Set title font
    pdf.set_font('helvetica', 'B', 16)

    # Title
    pdf.cell(0, 10, 'Loan Calculator Report', 0, 1, 'C')
    pdf.ln(5)

    # Add timestamp
    pdf.set_font('helvetica', '', 10)
    pdf.cell(
        0, 10, f'Generated on: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}', ln=True)
    pdf.ln(10)

    # Loan Summary Section
    pdf.set_font('Arial', 'B', 14)
    pdf.cell(0, 10, 'Loan Summary', ln=True)
    pdf.ln(5)

    # Add loan details
    pdf.set_font('Arial', '', 12)
    original_term_months = loan_details['original_term_months']
    actual_term_months = len(loan_details['amortization_schedule'])

    details = [
        f'Property Value: {format_currency(loan_details.get("property_value", loan_details["loan_amount"]), for_pdf=True)}',
        f'Own Funds: {format_currency(loan_details.get("own_funds", 0), for_pdf=True)}',
        f'Loan Amount: {format_currency(loan_details["loan_amount"], for_pdf=True)}',
        f'Annual Interest Rate: {loan_details["annual_interest_rate"]:.2f}%',
        f'Monthly Payment: {format_currency(loan_details["monthly_payment"], for_pdf=True)}',
        f'Original Loan Term: {original_term_months/12:.1f} years',
        f'Actual Loan Term: {actual_term_months/12:.1f} years',
        f'Base Monthly Payments: {format_currency(loan_details["monthly_payment"] * len(loan_details["amortization_schedule"]), for_pdf=True)}',
        f'Total Amount Paid: {format_currency(loan_details["total_payment"], for_pdf=True)}',
        f'Total Interest: {format_currency(loan_details["total_interest"], for_pdf=True)}',
        f'Annual Extra Payment: {format_currency(loan_details.get("annual_extra_payment", 0), for_pdf=True)}'
    ]

    # Calculate total extra payments
    total_extra_payments = sum(payment['extra_payment']
                               for payment in loan_details['amortization_schedule'])
    if total_extra_payments > 0:
        actual_total = loan_details['monthly_payment'] * \
            len(loan_details['amortization_schedule']) + total_extra_payments
        details.extend([
            f'Total Extra Payments: {format_currency(total_extra_payments, for_pdf=True)}',
            f'Actual Total Payments: {format_currency(actual_total, for_pdf=True)}'
        ])

    # Add fixed period info if applicable
    if 'fixed_period_remaining' in loan_details:
        details.append(
            f'Remaining After Fixed Period: {format_currency(loan_details["fixed_period_remaining"], for_pdf=True)}')
    # Include fixed period interest if available
    if 'fixed_period_interest' in loan_details and loan_details['fixed_period_interest'] > 0:
        details.append(f'Interest Paid During Fixed Period: {format_currency(loan_details["fixed_period_interest"], for_pdf=True)}')

    for detail in details:
        pdf.formatted_cell(0, 10, detail, ln=True)

    # Add amortization schedule
    pdf.add_page()
    pdf.set_font('Arial', 'B', 14)
    pdf.cell(0, 10, 'Amortization Schedule', ln=True)
    pdf.ln(5)

    # Calculate column widths based on page width
    page_width = pdf.w - 2 * pdf.l_margin
    col_widths = [20, 45, 45, 45]  # Month, Principal, Interest, Balance

    # Table header
    pdf.set_font('Helvetica', 'B', 9)
    pdf.set_fill_color(240, 240, 240)

    # Table headers
    pdf.set_fill_color(240, 240, 240)
    pdf.cell(col_widths[0], 7, 'Month', 1, 0, 'C', True)
    pdf.cell(col_widths[1], 7, 'Principal', 1, 0, 'C', True)
    pdf.cell(col_widths[2], 7, 'Interest', 1, 0, 'C', True)
    pdf.cell(col_widths[3], 7, 'Balance', 1, 1, 'C', True)
    pdf.ln()

    # Table content
    pdf.set_font('Helvetica', '', 8)

    # Track yearly totals
    yearly_data = {}

    # Show all months until the loan is paid off
    pdf.set_font('Helvetica', '', 8)
    for payment in loan_details['amortization_schedule']:
        month = payment['month']

        # Show monthly details
        pdf.cell(col_widths[0], 6, str(month), 1)
        pdf.cell(col_widths[1], 6, format_currency(
            payment['principal_payment'], for_pdf=True), 1)
        pdf.cell(col_widths[2], 6, format_currency(
            payment['interest_payment'], for_pdf=True), 1)
        pdf.cell(col_widths[3], 6, format_currency(
            payment['remaining_balance'], for_pdf=True), 1, 1)
        pdf.ln()

        # Collect yearly data
        year = (payment['month'] - 1) // 12
        if year not in yearly_data:
            yearly_data[year] = {
                'principal': 0,
                'interest': 0,
                'balance': payment['remaining_balance']
            }
        yearly_data[year]['principal'] += payment['principal_payment']
        yearly_data[year]['interest'] += payment['interest_payment']
        yearly_data[year]['balance'] = payment['remaining_balance']

        # Break if balance is zero (loan is paid off)
        if payment['remaining_balance'] == 0:
            break

    # Add yearly summaries
    pdf.add_page()
    pdf.set_font('Helvetica', 'B', 14)
    pdf.cell(0, 10, 'Yearly Summaries', ln=True)
    pdf.ln(5)

    # Table header for yearly summary
    pdf.set_font('Helvetica', 'B', 9)
    pdf.set_fill_color(240, 240, 240)
    pdf.cell(col_widths[0], 7, 'Year', 1, 0, 'C', True)
    pdf.cell(col_widths[1], 7, 'Principal', 1, 0, 'C', True)
    pdf.cell(col_widths[2], 7, 'Interest', 1, 0, 'C', True)
    pdf.cell(col_widths[3], 7, 'Balance', 1, 1, 'C', True)
    pdf.ln()

    # Yearly summary content
    pdf.set_font('Helvetica', '', 8)
    for year in sorted(yearly_data.keys()):
        pdf.cell(col_widths[0], 6, f'Year {year+1}', 1)
        pdf.cell(col_widths[1], 6, format_currency(
            yearly_data[year]['principal'], for_pdf=True), 1)
        pdf.cell(col_widths[2], 6, format_currency(
            yearly_data[year]['interest'], for_pdf=True), 1)
        pdf.cell(col_widths[3], 6, format_currency(
            yearly_data[year]['balance'], for_pdf=True), 1, 1)
        pdf.ln()

    # Add the plot
    pdf.add_page()
    # Calculate image dimensions to fit page while maintaining aspect ratio
    img_w = pdf.w - 2 * pdf.l_margin
    img_h = img_w * 0.5  # Maintain 2:1 aspect ratio
    pdf.image(plot_path, x=pdf.l_margin, y=30, w=img_w, h=img_h)

    # Save the PDF
    filename = f'amount_{np.int32(loan_details["loan_amount"])}_{datetime.now().strftime("%Y%m%d_%H%M%S")}.pdf'
    pdf.output(filename)
    print(f'\nReport saved as: {filename}')

    # Clean up the temporary plot file
    os.remove(plot_path)


def format_currency(amount, for_pdf=False):
    """Format amount as currency with 2 decimal places in euros."""
    formatted = f"{amount:,.2f}"
    if for_pdf:
        return f"EUR {formatted}"
    return f"€{formatted}"


def plot_loan_burndown(loan_details, save_to_file=None):
    """
    Create a visualization of the loan amortization over time.

    Args:
        loan_details (dict): Dictionary containing loan calculation results
    """
    # Extract data from amortization schedule
    months = []
    balances = []
    principal_payments = []
    interest_payments = []
    cumulative_principal = []
    cumulative_interest = []

    total_principal = 0
    total_interest = 0

    for payment in loan_details['amortization_schedule']:
        months.append(payment['month'])
        balances.append(payment['remaining_balance'])
        principal_payments.append(payment['principal_payment'])
        interest_payments.append(payment['interest_payment'])

        total_principal += payment['principal_payment']
        total_interest += payment['interest_payment']

        cumulative_principal.append(total_principal)
        cumulative_interest.append(total_interest)

    # Create the plot
    plt.figure(figsize=(12, 6))

    # Plot remaining balance
    plt.plot(months, balances, 'b-', label='Remaining Balance', linewidth=2)

    # Plot cumulative payments (stacked area)
    plt.fill_between(months, cumulative_principal, alpha=0.3,
                     color='g', label='Principal Paid')
    plt.fill_between(months, cumulative_interest, alpha=0.3,
                     color='r', label='Interest Paid')

    # Plot extra payments as markers
    extra_payment_months = []
    extra_payment_amounts = []
    for payment in loan_details['amortization_schedule']:
        if payment['extra_payment'] > 0:
            extra_payment_months.append(payment['month'])
            extra_payment_amounts.append(
                payment['remaining_balance'] + payment['extra_payment'])

    if extra_payment_months:
        plt.scatter(extra_payment_months, extra_payment_amounts,
                    color='yellow', edgecolor='black', s=100,
                    label='Extra Payments', zorder=5)

    # Customize the plot
    plt.title('Loan Amortization Over Time')
    plt.xlabel('Month')
    plt.ylabel('Amount (€)')
    plt.grid(True, linestyle='--', alpha=0.7)
    plt.legend()

    # Format y-axis with euro symbol
    plt.gca().yaxis.set_major_formatter(
        plt.FuncFormatter(lambda x, p: f'€{x:,.0f}'))

    # Add fixed period marker if applicable
    if 'fixed_period_remaining' in loan_details:
        fixed_period_months = len(
            months) // (len(months) // 12) * loan_details.get('fixed_period_years', 0)
        if fixed_period_months > 0:
            plt.axvline(x=fixed_period_months, color='purple', linestyle='--',
                        label='End of Fixed Period')
            plt.legend()

    plt.tight_layout()
    if save_to_file:
        plt.savefig(save_to_file, bbox_inches='tight', dpi=300)
        plt.close()
    else:
        plt.show()


def display_loan_summary(loan_details):
    """
    Display a formatted summary of the loan details.

    Args:
        loan_details (dict): Dictionary containing loan calculation results
    """
    print("\nLoan Payment Summary")
    print("=" * 50)
    print(f"Loan Amount: {format_currency(loan_details['loan_amount'])}")
    print(f"Annual Interest Rate: {loan_details['annual_interest_rate']:.2f}%")
    print(
        f"Monthly Payment: {format_currency(loan_details['monthly_payment'])}")
    print(
        f"Annual Extra Payment: {format_currency(loan_details.get('annual_extra_payment', 0))}")

    # Calculate total of extra payments
    total_extra_payments = sum(payment['extra_payment']
                               for payment in loan_details['amortization_schedule'])

    # Calculate actual total payments including extra payments
    actual_total_payments = loan_details['monthly_payment'] * \
        len(loan_details['amortization_schedule'])
    actual_total_payments += total_extra_payments

    base_payment_total = loan_details['monthly_payment'] * \
        len(loan_details['amortization_schedule'])
    print(
        f"Base Monthly Payments Total: {format_currency(base_payment_total)}")
    if total_extra_payments > 0:
        print(f"Total Extra Payments: {format_currency(total_extra_payments)}")
    print(
        f"Total Amount Paid: {format_currency(loan_details['total_payment'])}")
    print(f"Total Interest: {format_currency(loan_details['total_interest'])}")

    # Show loan terms and time saved
    original_term_months = loan_details['original_term_months']
    actual_term_months = len(loan_details['amortization_schedule'])
    print(f"\nOriginal Loan Term: {original_term_months/12:.1f} years")
    print(f"Actual Loan Term: {actual_term_months/12:.1f} years")

    if actual_term_months < original_term_months:
        years_saved = (original_term_months - actual_term_months) / 12
        print(f"Time Saved: {years_saved:.1f} years with extra payments!")

    if 'fixed_period_remaining' in loan_details:
        print("\nFixed Interest Period Summary")
        print("=" * 50)
        print(
            f"Remaining Loan After Fixed Period: {format_currency(loan_details['fixed_period_remaining'])}")
        if 'fixed_period_interest' in loan_details:
            print(f"Interest Paid During Fixed Period: {format_currency(loan_details['fixed_period_interest'])}")


def display_amortization_schedule(loan_details):
    """
    Display the amortization schedule in a formatted table.

    Args:
        loan_details (dict): Dictionary containing loan calculation results
    """
    print("\nMonthly Amortization Schedule")
    print("=" * 75)
    print(f"{'Month':^6} | {'Principal':^15} | {'Interest':^15} | {'Balance':^15}")
    print("-" * 75)

    # Track yearly totals
    yearly_data = {}

    for payment in loan_details['amortization_schedule']:
        # Show monthly details
        print(f"{payment['month']:^6} | "
              f"{format_currency(payment['principal_payment']):>15} | "
              f"{format_currency(payment['interest_payment']):>15} | "
              f"{format_currency(payment['remaining_balance']):>15}")

        # Collect yearly data
        year = (payment['month'] - 1) // 12
        if year not in yearly_data:
            yearly_data[year] = {
                'principal': 0,
                'interest': 0,
                'balance': payment['remaining_balance']
            }
        yearly_data[year]['principal'] += payment['principal_payment']
        yearly_data[year]['interest'] += payment['interest_payment']
        yearly_data[year]['balance'] = payment['remaining_balance']

        # Break if balance is zero (loan is paid off)
        if payment['remaining_balance'] == 0:
            break

    # Display yearly summaries
    print("\nYearly Summaries")
    print("=" * 75)
    print(f"{'Year':^6} | {'Principal':^15} | {'Interest':^15} | {'Balance':^15}")
    print("-" * 75)

    for year in sorted(yearly_data.keys()):
        print(f"{year+1:^6} | "
              f"{format_currency(yearly_data[year]['principal']):>15} | "
              f"{format_currency(yearly_data[year]['interest']):>15} | "
              f"{format_currency(yearly_data[year]['balance']):>15}")


def calculate_loan_term(loan_amount, annual_interest_rate, monthly_payment):
    """
    Calculate the loan term in years for a given monthly payment.

    Args:
        loan_amount (float): Principal amount of the loan
        annual_interest_rate (float): Annual interest rate (in percentage)
        monthly_payment (float): Desired monthly payment amount

    Returns:
        float: Loan term in years
    """
    monthly_rate = (annual_interest_rate / 100) / 12

    if monthly_payment <= loan_amount * monthly_rate:
        raise ValueError(
            "Monthly payment too low - loan would never be paid off")

    # Using the loan amortization formula solved for n:
    # n = ln(PMT/(PMT-P*r)) / ln(1+r)
    # where PMT = monthly payment, P = principal, r = monthly rate
    num_payments = np.log(monthly_payment / (monthly_payment -
                          loan_amount * monthly_rate)) / np.log(1 + monthly_rate)
    return num_payments / 12


def calculate_loan_payments(loan_amount, annual_interest_rate, monthly_payment, fixed_interest_period_years=None, include_extra_payment=False):
    """
    Calculate loan payments and amortization schedule.

    Args:
        loan_amount (float): Principal amount of the loan
        annual_interest_rate (float): Annual interest rate (in percentage)
        loan_term_years (int): Length of the loan in years
        fixed_interest_period_years (int, optional): Length of fixed interest period in years
        include_extra_payment (bool): Whether to include annual extra payment of 5% of loan amount

    Returns:
        dict: Dictionary containing:
            - monthly_payment: Fixed monthly payment amount
            - total_payment: Total amount paid over loan term
            - total_interest: Total interest paid over loan term
            - fixed_period_remaining: Remaining loan amount after fixed interest period
            - amortization_schedule: List of dictionaries with monthly payment details
    """
    # Convert annual interest rate to monthly rate (decimal)
    monthly_rate = (annual_interest_rate / 100) / 12

    # Calculate loan term from monthly payment
    loan_term_years = calculate_loan_term(
        loan_amount, annual_interest_rate, monthly_payment)
    total_payments = int(np.ceil(loan_term_years * 12))

    # Initialize variables for tracking
    remaining_balance = loan_amount
    total_interest = 0
    fixed_period_interest = 0
    amortization_schedule = []

    # Calculate annual extra payment (5% of original loan amount)
    annual_extra_payment = loan_amount * 0.05 if include_extra_payment else 0

    # Calculate amortization schedule
    for month in range(1, total_payments + 1):
        # Calculate interest portion of monthly payment
        interest_payment = remaining_balance * monthly_rate

        # Track interest during fixed period if specified
        if fixed_interest_period_years is not None:
            fixed_period_months = fixed_interest_period_years * 12
            if month <= fixed_period_months:
                fixed_period_interest += interest_payment

        # Calculate principal portion of monthly payment
        principal_payment = min(
            monthly_payment - interest_payment, remaining_balance)

        # Add extra payment if it's December (month % 12 == 0) and there's remaining balance
        extra_payment = 0
        if include_extra_payment and month % 12 == 0 and remaining_balance > 0:
            extra_payment = min(annual_extra_payment,
                                remaining_balance - principal_payment)
            principal_payment += extra_payment

        # Update remaining balance
        remaining_balance = max(0, remaining_balance - principal_payment)

        # Update total interest
        total_interest += interest_payment

        # Store monthly payment breakdown
        amortization_schedule.append({
            'month': month,
            'principal_payment': principal_payment,
            'interest_payment': interest_payment,
            'remaining_balance': remaining_balance,
            'extra_payment': extra_payment
        })

        # If loan is fully paid off, break the loop
        if remaining_balance == 0:
            break

    # Calculate actual total payments (including extra payments)
    total_payment = sum(payment['principal_payment'] + payment['interest_payment']
                        for payment in amortization_schedule)

    result = {
        'loan_amount': loan_amount,
        'annual_interest_rate': annual_interest_rate,
        'monthly_payment': monthly_payment,
        'total_payment': total_payment,
        'total_interest': total_interest,
        'fixed_period_interest': fixed_period_interest,
        'annual_extra_payment': annual_extra_payment if include_extra_payment else 0,
        'amortization_schedule': amortization_schedule
    }

    # Calculate remaining loan amount after fixed interest period if specified
    if fixed_interest_period_years is not None:
        fixed_period_months = fixed_interest_period_years * 12
        if fixed_period_months <= total_payments:
            result['fixed_period_remaining'] = amortization_schedule[fixed_period_months -
                                                                     1]['remaining_balance']

    return result


if __name__ == "__main__":
    # Example usage
    print("Loan Calculator")
    print("=" * 50)

    # Get user input
    loan_amount = float(input("Enter loan amount: €"))
    annual_interest_rate = float(input("Enter annual interest rate (%): "))

    while True:
        try:
            monthly_payment = float(input("Enter desired monthly payment: €"))
            loan_term_years = calculate_loan_term(
                loan_amount, annual_interest_rate, monthly_payment)
            print(
                f"\nWith this payment, the loan will be paid off in {loan_term_years:.1f} years")
            if input("Proceed with this payment plan? (y/n): ").lower() == 'y':
                break
        except ValueError as e:
            print(f"\nError: {e}\nPlease enter a larger monthly payment.")

    fixed_period = input(
        "Enter fixed interest period (years), or press Enter to skip: ").strip()

    # Ask about extra payments
    include_extra = input(
        "Include annual extra payment of 5% of loan amount? (y/n): ").lower() == 'y'

    # Calculate loan details
    fixed_period_years = int(fixed_period) if fixed_period.isdigit() else None
    loan_details = calculate_loan_payments(
        loan_amount,
        annual_interest_rate,
        monthly_payment,
        fixed_period_years,
        include_extra_payment=include_extra
    )

    # Store original term for comparison
    loan_details['original_term_months'] = loan_term_years * 12

    # Display results
    display_loan_summary(loan_details)

    # Ask if user wants to see the full amortization schedule
    show_schedule = input(
        "\nWould you like to see the full amortization schedule? (y/n): ")
    if show_schedule.lower() == 'y':
        display_amortization_schedule(loan_details)

    # Show the loan burndown plot and save report\n    save_pdf = input("\\nWould you like to save a PDF report? (y/n): ").lower() == 'y'\n    \n    if save_pdf:\n        try:\n            from fpdf import FPDF\n        except ImportError:\n            print("\\nThe 'fpdf' library is required for PDF generation.")\n            print("Please install it using: pip install fpdf2")\n            save_pdf = False
        # Create temporary plot file
        temp_plot = 'temp_loan_plot.png'
        plot_loan_burndown(loan_details, save_to_file=temp_plot)
        try:
            save_to_pdf(loan_details, temp_plot)
        except Exception as e:
            print(f"\nError generating PDF: {str(e)}")
            print("Showing plot instead.")
            plot_loan_burndown(loan_details)
        finally:
            # Clean up temporary file even if PDF generation fails
            if os.path.exists(temp_plot):
                try:
                    os.remove(temp_plot)
                except:
                    pass

    else:
        plot_loan_burndown(loan_details)
