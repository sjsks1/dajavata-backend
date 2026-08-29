import FinanceDataReader as fdr
import pandas as pd

df = fdr.StockListing('KRX')
print(df.columns)
print(df.head(2))
