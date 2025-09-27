from flask import Flask, render_template, request, send_file, session
from calculator import LoanCalculator
from loan_calculator import save_to_pdf
import os
import glob
import io
import traceback
from datetime import datetime

import tempfile
import base64

import matplotlib
matplotlib.use('Agg')

app = Flask(__name__)
app.secret_key = os.urandom(24)  # Set a secret key for session
loan_calculator = LoanCalculator()


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/calculate', methods=['POST'])
def calculate():
    try:
        # Store complete loan details in session for PDF generation
        session['loan_data'] = None  # Clear any previous data

        # Parse form data for calculation
        property_value = float(request.form['property_value'])
        own_funds = float(request.form['own_funds'])

        # Calculate loan amount from property value and own funds
        loan_amount = property_value - own_funds

        if loan_amount < 0:
            raise ValueError("Own funds cannot exceed property value")
        if loan_amount == 0:
            raise ValueError(
                "Loan amount cannot be zero. Own funds must be less than property value.")

        annual_interest_rate = float(request.form['annual_interest_rate'])
        monthly_payment = float(request.form['monthly_payment'])
        include_extra = request.form.get('include_extra') == 'true'
        fixed_period = request.form.get('fixed_period', '')

        fixed_period_years = int(
            fixed_period) if fixed_period.isdigit() else None

        # Calculate loan details
        loan_details = loan_calculator.calculate_loan_payments(
            loan_amount,
            annual_interest_rate,
            monthly_payment,
            fixed_period_years,
            include_extra_payment=include_extra
        )

        # Store fixed period years in loan details
        if fixed_period_years:
            loan_details['fixed_period_years'] = fixed_period_years

        # Store original term for comparison
        loan_term_years = loan_calculator.calculate_loan_term(
            loan_amount, annual_interest_rate, monthly_payment)
        loan_details['original_term_months'] = loan_term_years * 12

        # Generate plot
        plot_data = loan_calculator.get_plot_data(loan_details)

        # Add property value and own funds to loan details
        loan_details['property_value'] = property_value
        loan_details['own_funds'] = own_funds

        # Store complete loan details in session for PDF generation
        session['loan_data'] = {
            'loan_details': loan_details,
            'plot_data': plot_data,
            'fixed_period_years': fixed_period_years
        }

        return render_template(
            'results.html',
            loan_details=loan_details,
            plot_data=plot_data,
            fixed_period_years=fixed_period_years
        )
    except ValueError as e:
        return render_template('index.html', error=str(e))


@app.route('/generate_pdf', methods=['POST'])
def generate_pdf():
    try:
        # Get the stored loan data from session
        if 'loan_data' not in session:
            return "No loan calculation data found. Please calculate the loan first.", 400

        loan_data = session['loan_data']
        loan_details = loan_data['loan_details']

        # Ensure plot_data is available in loan_details
        if 'plot_data' in loan_data:
            loan_details['plot_data'] = loan_data['plot_data']

        try:
            # Decode plot data and save to temporary file
            plot_data_b64 = loan_details.get('plot_data')
            with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as tmp_plot:
                tmp_plot.write(base64.b64decode(plot_data_b64))
                plot_path = tmp_plot.name

            try:
                # Generate PDF using the LoanCalculator's generate_pdf method
                pdf_bytes = loan_calculator.generate_pdf(loan_details)

                # Set filename for the PDF
                timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
                filename = f'amount_{int(loan_details["loan_amount"])}_{timestamp}.pdf'

                # Create response with PDF
                response = send_file(
                    io.BytesIO(pdf_bytes),
                    mimetype='application/pdf',
                    as_attachment=True,
                    download_name=filename
                )
                response.headers['Content-Type'] = 'application/pdf'
                return response

            finally:
                # Clean up temporary plot file
                if os.path.exists(plot_path):
                    os.remove(plot_path)

        except Exception as e:
            app.logger.error(
                f"Error generating PDF: {str(e)}\n{traceback.format_exc()}")
            return render_template('results.html', loan_details=loan_details, plot_data=loan_data.get('plot_data'), fixed_period_years=loan_data.get('fixed_period_years'), error=f"PDF generation failed: {str(e)}"), 500

    except ValueError as e:
        app.logger.error(f"Error with input values: {str(e)}")
        return f"Invalid input: {str(e)}", 400
    except Exception as e:
        app.logger.error(
            f"Unexpected error: {str(e)}\n{traceback.format_exc()}")
        return f"Unexpected error: {str(e)}", 500


if __name__ == '__main__':
    app.run(debug=True)
