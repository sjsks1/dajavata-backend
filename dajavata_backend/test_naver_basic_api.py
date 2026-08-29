import asyncio
import aiohttp

async def test_naver_basic_api():
    code = '005930'
    url = f"https://m.stock.naver.com/api/stock/{code}/basic"
    headers = {'User-Agent': 'Mozilla/5.0'}
    
    async with aiohttp.ClientSession() as session:
        async with session.get(url, headers=headers) as res:
            data = await res.json()
            print(data.keys())
            print(f"high52Week: {data.get('high52Week')}")
            print(f"low52Week: {data.get('low52Week')}")
            
if __name__ == "__main__":
    asyncio.run(test_naver_basic_api())
