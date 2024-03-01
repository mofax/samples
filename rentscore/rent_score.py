import math
import re
from typing import Any, Dict, List

import pprint
from datetime import datetime
import polars as pl
from polars.datatypes.classes import Unknown


class InvalidDateFormatError(Exception):
    pass


class InvalidDateError(Exception):
    pass


# This function generally lives in a separate file
def validate_date(item: str) -> datetime:
    # Regular expression to match the date format MM/DD/yyyy
    date_pattern = re.compile(r"^(0[1-9]|1[0-2])/(0[1-9]|[12][0-9]|3[01])/\d{4}$")

    # Check if the string matches the pattern
    if not date_pattern.match(item):
        raise InvalidDateFormatError(
            f"The date '{item}' is not in the MM/DD/yyyy format."
        )

    # Validate if the date is a real date (e.g., not 02/30/2021)
    try:
        return datetime.strptime(item, "%m/%d/%Y")
    except ValueError:
        raise InvalidDateError(f"The date '{item}' is not a valid date.")


def process_payment(
    expected_date: str,
    actual_date: str,
    amount_paid: float,
    full_rent: float,
    pending_rent: float,
):
    """
    Process a  rent payment.
    Return a dictionary with the following keys:

    - 'score': An integer representing a score for the payment.
    - 'amount_paid': A float representing the amount paid.
    - 'amount_type': A string representing the type of payment ('full', 'extra', or 'partial'). This is in comparison to the total rent
    - 'payment_status': A string representing the status of the payment ('early', 'on-time', 'late', 'late-2', 'late-3', 'arrears', or 'extended-arrears').
    - 'date_expected': A datetime object representing the expected date of the payment.
    - 'date_received': A datetime object representing the actual date the payment was received.
    - 'date_days_gap': An integer representing the difference in days between the expected and actual payment dates.

    Parameters:
    - expected_date: A string representing the expected date of the payment in the MM/DD/yyyy format. This is the date that the landlord expects payment
    - actual_date: A string representing the actual date the payment was received in the MM/DD/yyyy format.
    - amount_paid: A float representing the amount paid.
    - full_rent: A float representing the full rent amount.
    - pending_rent: A float representing the pending rent amount. For example if rent was missed last month, this would the double to monthly rent

    Returns:
    - A dictionary with the keys and values described above.

    Example:
    process_payment('01/01/2022', '01/01/2022', 1000.0, 2000.0, 1000.0)
    """

    validated_expected_date = validate_date(expected_date)
    validated_actual_date = validate_date(actual_date)
    days_delta = (validated_expected_date - validated_actual_date).days

    score = 10
    payment_status = "on-time"

    if days_delta > 0:
        score = 10
        payment_status = "early"
    elif days_delta == 0:
        score = 10
        payment_status = "on-time"
    elif days_delta >= -10:
        score = 8
        payment_status = "late"
    elif days_delta >= -15:
        score = 6
        payment_status = "late-2"
    elif days_delta >= -20:
        score = 5
        payment_status = "late-3"
    elif days_delta >= -30:
        score = 3
        payment_status = "arrears"
    else:
        score = 0
        payment_status = "extended-arrears"

    # Adjust the score based on the amount paid
    score *= amount_paid / pending_rent

    # Maximum achievable score is 10
    # So that, if you pay extra rent for that month, you still get a 10
    score = math.floor(min(score, 10))

    # Determine if the payment is full or partial
    if amount_paid == pending_rent:
        amount_type = "full"
    elif amount_paid > pending_rent:
        amount_type = "extra"
    else:
        amount_type = "partial"

    return {
        "score": score,
        "amount_paid": amount_paid,
        "amount_type": amount_type,
        "payment_status": payment_status,
        "date_expected": validated_expected_date,
        "date_received": validated_actual_date,
        "date_days_gap": days_delta,
    }


def generate_rent_score(full_rent: float, payments: pl.DataFrame):
    """
    Generate a rent score based on the provided rent data.

    Parameters:
    - full_rent: A float representing the full expected monthly rent.
    - payments: A polars DataFrame containing the rent payment data. Each row should contain the following columns:
        - 'expected_date': A string representing the expected date of the payment in the MM/DD/yyyy format. 
           (This would be preprocessed from another process)
        - 'actual_date': A string representing the actual date the payment was received in the MM/DD/yyyy format.
        - 'amount_paid': A float representing the amount paid.

    Returns:
    - A dictionary with the following keys:
        - 'total_score': An integer representing the total rent score.
        - 'transactions': A list of dictionaries, each representing a month's rent payment data. 
            Each dictionary contains the following keys:
            - 'score': An integer representing the score for the month's rent payment.
            - 'total_paid': A float representing the total amount paid for the month.
            - 'total_expected': A float representing the total expected rent for the month.
            - 'total_balance': A float representing the remaining balance after the month's rent payment.
            - 'transactions': A list of dictionaries, each representing a single rent payment transaction.
                If you pay rent in portions multiple times in a month, this list would have an entry
                for each of those transactions.
                Each dictionary contains the following keys:
                - 'score': An integer representing the score for that transaction.
                - 'amount_paid': A float representing the amount paid.
                - 'amount_type': A string representing the type of payment ('full', 'extra', or 'partial').
                - 'payment_status': A string representing the status of the payment ('early', 'on-time', 'late', 'late-2', 'late-3', 'arrears', or 'extended-arrears').
                - 'date_expected': A datetime object representing the expected date of the payment.
                - 'date_received': A datetime object representing the actual date the payment was received.
                - 'date_days_gap': An integer representing the difference in days between the expected and actual payment dates.
    """
    scores: List[Dict[str, Any]] = []

    # We the transactions as a flat list, the first thing to do is group them into months
    def group_transactions_with_months():
        grouped_months: Dict[str, List] = {}
        for row in payments.iter_rows():
            expected_date = validate_date(row[0])
            key_str = expected_date.strftime("%m/%Y")
            if key_str in grouped_months:
                grouped_months[key_str].append(row)
            else:
                grouped_months[key_str] = [row]

        return grouped_months

    grouped_months = group_transactions_with_months()

    # After grouping this function will process payments for each month
    def compute_payments_each_month(month: str, expected_total: float, payments: List):
        computations: List = []
        total = 0
        score = 0
        expected_total_consumed = expected_total
        for row in payments:
            rent_date = row[0]
            payment_date = row[1]
            amount_paid = row[2]
            comp = process_payment(
                rent_date, payment_date, amount_paid, full_rent, expected_total_consumed
            )
            computations.append(comp)

            score = comp["score"] + score
            total = comp["amount_paid"] + total
            expected_total_consumed = expected_total_consumed - comp["amount_paid"]

        return {
            "score": score,
            "total_paid": total,
            "total_expected": expected_total,
            "total_balance": expected_payment - total,
            "transactions": computations,
        }

    # TODO: There is probably a better way to do this
    # We are using expected_payment as a bucket to show how much rent has been made
    # For each Month, It starts off as full rent + (amount in rent missed last month), then reduces by the amount of money received.
    expected_payment = full_rent
    transactions: List = []
    for key, value in grouped_months.items():
        response = compute_payments_each_month(key, expected_payment, value)

        if response["total_balance"] == 0:
            expected_payment = full_rent
        else:
            expected_payment = response["total_balance"] + expected_payment

        transactions.append(response)

    total_score = 0
    for item in transactions:
        total_score = item["score"] + total_score

    return {"total_score": total_score, "transactions": transactions}
