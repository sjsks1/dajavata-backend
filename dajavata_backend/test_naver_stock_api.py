import asyncio
import aiohttp

async def test_naver_api():
    code = '005930'
    url = f"https://m.stock.naver.com/api/stock/{code}/integration"
    headers = {'User-Agent': 'Mozilla/5.0'}
    
    async with aiohttp.ClientSession() as session:
        async with session.get(url, headers=headers) as res:
            data = await res.json()
            
            # Print the keys
            print(data.keys())
            
            # See if we have fundamental info
            if 'totalInfos' in data:
                total_infos = data['totalInfos']
                for info in total_infos:
                    if info.get('key') in ['PER', 'PBR', 'EPS', 'BPS', 'dividendYield']:
                        print(f"{info.get('key')}: {info.get('value')}")
            
if __name__ == "__main__":
    asyncio.run(test_naver_api())
