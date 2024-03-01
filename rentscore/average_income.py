import polars as pl


def mpesa_infer_monthly_income(transactions: pl.DataFrame) -> float:
    """
    This functions consumes m-pesa statements that have been converted from pdf to csv in another process
    The columns we are looking for are called 'paid_in' and 'completion_time'
    - paid_in is null if the transaction was a withdrawal but contains a value if it was a deposit
    - completion_time indicates when the transaction was committed by the m-pesa database
    """
    # Clean and convert paid_in column to float, handling commas and nulls
    transactions = transactions.with_columns(
        pl.col("paid_in").str.replace(",", "").cast(float).fill_null(0)
    )

    total_income = transactions.select(pl.sum("paid_in")).to_numpy()[0, 0]

    # Count the number of unique months based on the completion_time column
    unique_months = transactions.select(
        pl.col("completion_time").dt.month().unique().count()
    ).to_numpy()[0, 0]

    # Calculate and return the average monthly income
    # First check and prevent division by zero
    if unique_months == 0:
        return total_income
    else:
        return total_income / unique_months
