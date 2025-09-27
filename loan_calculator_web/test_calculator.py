from calculator import LoanCalculator


def test_payment_components():
    calc = LoanCalculator()

    # Test case with simple numbers
    loan_amount = 100000
    annual_interest_rate = 3.0
    monthly_payment = 1000

    loan_details = calc.calculate_loan_payments(
        loan_amount=loan_amount,
        annual_interest_rate=annual_interest_rate,
        monthly_payment=monthly_payment,
        fixed_interest_period_years=None,
        include_extra_payment=False
    )

    total_payment = loan_details['total_payment']
    total_interest = loan_details['total_interest']
    total_principal = sum(payment['principal_payment']
                          for payment in loan_details['amortization_schedule'])

    print(f"\nLoan Amount: €{loan_amount:,.2f}")
    print(f"Total Payment: €{total_payment:,.2f}")
    print(f"Total Interest: €{total_interest:,.2f}")
    print(f"Total Principal Paid: €{total_principal:,.2f}")
    print(
        f"Total Payment - Total Interest = €{(total_payment - total_interest):,.2f}")
    print(
        f"Difference from loan amount: €{(total_payment - total_interest - loan_amount):,.2f}")

    # Print first few payments to see the breakdown
    print("\nFirst few payments breakdown:")
    print("Month | Principal | Interest | Total | Remaining Balance")
    print("-" * 65)
    for payment in loan_details['amortization_schedule'][:5]:
        print(f"{payment['month']:5d} | €{payment['principal_payment']:9,.2f} | €{payment['interest_payment']:8,.2f} | €{(payment['principal_payment'] + payment['interest_payment']):7,.2f} | €{payment['remaining_balance']:,.2f}")


if __name__ == '__main__':
    test_payment_components()
