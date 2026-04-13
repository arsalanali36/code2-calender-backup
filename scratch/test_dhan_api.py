import requests
from datetime import datetime, timedelta

DHAN_TOKEN = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzUxMiJ9.eyJpc3MiOiJkaGFuIiwicGFydG5lcklkIjoiIiwiZXhwIjoxNzc2MTY3NTQzLCJpYXQiOjE3NzYwODExNDMsInRva2VuQ29uc3VtZXJUeXBlIjoiU0VMRiIsIndlYmhvb2tVcmwiOiIiLCJkaGFuQ2xpZW50SWQiOiIxMTAxMzEwOTc2In0.AUpYSyowfCeRwffirCJLyCbvdsML-sk75RxUjFlUqvSMQXcnJsvwJivpZQd7_dVdzDjV5c9lE6488cJZpFp6XA"

def check_date(date_str):
    url = "https://api.dhan.co/charts/intraday"
    payload = {
        "securityId": "13", 
        "exchangeSegment": "IDX_I", 
        "instrument": "INDEX", 
        "fromDate": date_str, 
        "toDate": date_str
    }
    headers = {"Content-Type": "application/json", "access-token": DHAN_TOKEN}
    res = requests.post(url, headers=headers, json=payload)
    if res.status_code == 200:
        d = res.json()
        if 'open' in d and d['open']:
            print(f"Date: {date_str} -> Success! First Open: {d['open'][0]}, Candles: {len(d['open'])}")
        else:
            print(f"Date: {date_str} -> Empty response")
    else:
        print(f"Date: {date_str} -> Error {res.status_code}: {res.text}")

today = datetime.now()
for i in range(5):
    ds = (today - timedelta(days=i)).strftime('%Y-%m-%d')
    check_date(ds)
