from loan_calculator import format_currency, calculate_loan_term, calculate_loan_payments
import matplotlib.pyplot as plt
from fpdf import FPDF
from datetime import datetime
import os
import io
import base64
import sys
from pathlib import Path
sys.path.append(str(Path(__file__).parent.parent))


class LoanCalculator:
    def __init__(self):
        pass

    def format_currency(self, amount, for_pdf=False):
        return format_currency(amount, for_pdf)

    def calculate_loan_term(self, loan_amount, annual_interest_rate, monthly_payment):
        return calculate_loan_term(loan_amount, annual_interest_rate, monthly_payment)

    def calculate_loan_payments(self, loan_amount, annual_interest_rate, monthly_payment,
                                fixed_interest_period_years=None, include_extra_payment=False):
        return calculate_loan_payments(
            loan_amount,
            annual_interest_rate,
            monthly_payment,
            fixed_interest_period_years,
            include_extra_payment=include_extra_payment
        )

    def get_plot_data(self, loan_details):
        """Generate plot data for web display."""
        months = []
        balances = []
        cumulative_principal = []
        cumulative_interest = []

        total_principal = 0
        total_interest = 0

        for payment in loan_details['amortization_schedule']:
            months.append(payment['month'])
            balances.append(payment['remaining_balance'])

            total_principal += payment['principal_payment']
            total_interest += payment['interest_payment']

            cumulative_principal.append(total_principal)
            cumulative_interest.append(total_interest)

        plt.figure(figsize=(12, 6))
        plt.plot(months, balances, 'b-',
                 label='Remaining Balance', linewidth=2)
        plt.fill_between(months, cumulative_principal,
                         alpha=0.3, color='g', label='Principal Paid')
        plt.fill_between(months, cumulative_interest, alpha=0.3,
                         color='r', label='Interest Paid')

        plt.title('Loan Amortization Over Time')
        plt.xlabel('Month')
        plt.ylabel('Amount (€)')
        plt.grid(True, linestyle='--', alpha=0.7)
        plt.legend()

        plt.gca().yaxis.set_major_formatter(
            plt.FuncFormatter(lambda x, p: f'€{x:,.0f}'))

        # Convert plot to base64 string for web display
        img_data = io.BytesIO()
        plt.savefig(img_data, format='png', bbox_inches='tight')
        img_data.seek(0)
        plt.close()

        return base64.b64encode(img_data.getvalue()).decode()

    def generate_pdf(self, loan_details):
        """Generate PDF report by using save_to_pdf from loan_calculator module."""
        from loan_calculator import save_to_pdf
        import tempfile

        # Save plot to temp file
        with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as tmp:
            plt.figure(figsize=(12, 6))
            plt.savefig(tmp.name, format='png', bbox_inches='tight', dpi=300)
            plt.close()

        # Get PDF filename using save_to_pdf
        filename = save_to_pdf(loan_details, tmp.name)

        # Read the PDF file and return its bytes
        with open(filename, 'rb') as f:
            pdf_bytes = f.read()

        # Clean up files
        os.remove(filename)
        os.remove(tmp.name)

        return pdf_bytes
