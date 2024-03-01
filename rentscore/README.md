# Usage

## RentScore

The file `rent_score.py` contains a function 

```py
def generate_rent_score(full_rent: float, payments: pl.DataFrame)
```

1. import this function and call with a `DATAFRAME` containing data as shown in `test_data.csv`

The function returns results that look like this

```md
{'score': 8,
 'total_balance': 0,
 'total_expected': 45000,
 'total_paid': 45000,
 'transactions': [{'amount_paid': 45000,
                   'amount_type': 'full',
                   'date_days_gap': -6,
                   'date_expected': datetime.datetime(2021, 1, 5, 0, 0),
                   'date_received': datetime.datetime(2021, 1, 11, 0, 0),
                   'payment_status': 'late',
                   'score': 8}]}

{'score': 10,
 'total_balance': 0,
 'total_expected': 45000,
 'total_paid': 45000,
 'transactions': [{'amount_paid': 45000,
                   'amount_type': 'full',
                   'date_days_gap': 1,
                   'date_expected': datetime.datetime(2021, 2, 5, 0, 0),
                   'date_received': datetime.datetime(2021, 2, 4, 0, 0),
                   'payment_status': 'early',
                   'score': 10}]}
```
2. Check out `rent_score.test.py` for example usage

## Average monthly income
The file `average_income.py` contains a function 

```py
def mpesa_infer_monthly_income(transactions: pl.DataFrame) -> float
```

This function takes a `DataFrame` that looks like data in `mpesa_statements.csv` and returns a float representing average monthly income
