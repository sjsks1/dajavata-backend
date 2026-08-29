import FinanceDataReader as fdr

try:
    df_desc = fdr.StockListing('KRX-DESC')
    print(df_desc.columns)
    print(df_desc.head(2))
except Exception as e:
    print(f"Error: {e}")
