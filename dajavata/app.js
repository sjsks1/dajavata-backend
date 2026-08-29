document.addEventListener('DOMContentLoaded', () => {
    const tbody = document.getElementById('table-body');
    const headerTitle = document.querySelector('.header-title h1');
    const themeBadge = document.querySelector('.theme-badge');
    
    // API URL
    const API_URL = 'https://dajavata-backend.onrender.com/api/themes'; 
    
    // Store fetched data globally for filtering
    window.allThemes = [];

    // 로딩 메시지
    tbody.innerHTML = '<tr><td colspan="12" class="center" style="padding: 40px; color: var(--text-muted);">데이터를 불러오는 중입니다...<br><span style="font-size: 13px;">(무료 서버 특성상 첫 접속 시 최대 1분 정도 소요될 수 있습니다)</span></td></tr>';
    
    // Fetch data
    fetch(API_URL)
        .then(response => response.json())
        .then(data => {
            window.allThemes = data.themes || [];
            if (window.allThemes.length === 0) {
                tbody.innerHTML = '<tr><td colspan="12" class="center">데이터를 불러올 수 없습니다. API 연결을 확인해주세요.</td></tr>';
                return;
            }
            // 최초 접속 시 전체 테마 렌더링
            renderTable(window.allThemes);
        })
        .catch(error => {
            console.error('Error fetching themes:', error);
            tbody.innerHTML = '<tr><td colspan="12" class="center">데이터를 불러오는 중 오류가 발생했습니다.</td></tr>';
        });

    // 테이블 렌더링 함수 (mode: 'themes' or 'stocks')
    function renderTable(dataList, mode = 'themes') {
        const thead = document.querySelector('#theme-table thead');
        tbody.innerHTML = ''; // 초기화

        if (dataList.length === 0) {
            tbody.innerHTML = '<tr><td colspan="15" class="center" style="padding: 40px;">데이터가 없습니다.</td></tr>';
            return;
        }

        if (mode === 'themes') {
            thead.innerHTML = `
                <tr>
                    <th>테마명</th>
                    <th class="right">전일비</th>
                    <th class="right">3일합산</th>
                    <th class="right">52주 상승률</th>
                    <th class="right">52주 하락률</th>
                    <th class="center">52주 소외지수</th>
                    <th class="right">3년 상승률</th>
                    <th class="right">3년 하락률</th>
                    <th class="center">3년 소외지수</th>
                    <th class="right">기대수익률</th>
                    <th class="center">테마차트(90일)</th>
                    <th class="center">업데이트</th>
                </tr>
            `;

            dataList.forEach(theme => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>
                        <div class="theme-name-cell" title="${theme.desc}">
                            <a href="#" class="theme-link" data-theme-name="${theme.name}" style="text-decoration: none; color: inherit; cursor: pointer;">${theme.name}</a>
                            <i class="ph ph-info" style="color: var(--text-muted); margin-left: 4px; font-size: 14px; cursor: help;"></i>
                        </div>
                    </td>
                    <td class="right"><span class="${theme.day1Pos ? 'pos' : 'neg'} price-main">${theme.day1}</span></td>
                    <td class="right"><span class="${theme.day3Pos ? 'pos' : 'neg'} price-main">${theme.day3}</span></td>
                    <td class="right"><span class="${theme.high52Pos ? 'pos' : 'neg'} price-main">${theme.high52}</span></td>
                    <td class="right"><span class="${theme.low52Pos ? 'pos' : 'neg'} price-main">${theme.low52}</span></td>
                    <td class="center"><span class="price-main" style="color: var(--text-main); font-weight: 800;">${theme.neglect52}</span></td>
                    <td class="right"><span class="${theme.high3yPos ? 'pos' : 'neg'} price-main">${theme.high3y}</span></td>
                    <td class="right"><span class="${theme.low3yPos ? 'pos' : 'neg'} price-main">${theme.low3y}</span></td>
                    <td class="center"><span class="price-main" style="color: var(--text-main); font-weight: 800;">${theme.neglect3y}</span></td>
                    <td class="right" style="background-color: rgba(255,255,255,0.03);">
                        <span class="price-main" style="font-weight: 800; color: var(--text-main);">${theme.expReturn}</span>
                    </td>
                    <td class="center">
                        <div class="mini-chart">
                            <svg viewBox="0 0 100 30" class="sparkline" style="width: 80px; height: 24px;">
                                <path d="M0,25 Q10,20 20,22 T40,15 T60,20 T80,5 T100,10" fill="none" stroke="var(--text-muted)" stroke-width="2"/>
                            </svg>
                        </div>
                    </td>
                    <td class="center" style="color: var(--text-muted); font-size: 12px;">${theme.update}</td>
                `;
                tbody.appendChild(tr);
            });

            // 테마 이름 클릭 시 해당 테마의 종목 리스트 로드
            document.querySelectorAll('.theme-link').forEach(link => {
                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    const themeName = e.target.getAttribute('data-theme-name');
                    loadThemeDetails(themeName);
                });
            });

        } else if (mode === 'stocks') {
            thead.innerHTML = `
                <tr>
                    <th>종목명</th>
                    <th class="right">현재가격</th>
                    <th class="right">3일합산</th>
                    <th class="right">52주 최고최저</th>
                    <th class="center">52주 소외지수</th>
                    <th class="right">3년 최고최저</th>
                    <th class="center">3년 소외지수</th>
                    <th class="right">기대수익률</th>
                    <th class="right">PBR</th>
                    <th class="right">PER</th>
                    <th class="right">EPS</th>
                    <th class="right">시가총액</th>
                </tr>
            `;

            dataList.forEach(stock => {
                const tr = document.createElement('tr');
                
                // Format numbers
                const price = new Intl.NumberFormat('ko-KR').format(stock.current_price || 0);
                const day3 = stock.day3 ? stock.day3.toFixed(2) : '0.00';
                const day3Class = stock.day3 >= 0 ? 'pos' : 'neg';
                const day3Sign = stock.day3 > 0 ? '+' : '';
                
                const high52 = stock.high52 ? stock.high52.toFixed(1) : '0.0';
                const low52 = stock.low52 ? stock.low52.toFixed(1) : '0.0';
                const neglect52 = stock.neglect52 ? stock.neglect52.toFixed(0) : '0';
                
                const high3y = stock.high3y ? stock.high3y.toFixed(1) : '0.0';
                const low3y = stock.low3y ? stock.low3y.toFixed(1) : '0.0';
                const neglect3y = stock.neglect3y ? stock.neglect3y.toFixed(0) : '0';
                
                const expRet = stock.expReturn ? stock.expReturn.toFixed(0) : '0';
                
                const pbr = stock.PBR ? stock.PBR.toFixed(2) : '-';
                const per = stock.PER ? stock.PER.toFixed(2) : '-';
                const eps = stock.EPS ? new Intl.NumberFormat('ko-KR').format(stock.EPS) : '-';
                
                // 시가총액 (조 단위 변환)
                let marcapStr = '-';
                if (stock.marcap) {
                    const jo = Math.floor(stock.marcap / 1000000000000);
                    const eok = Math.floor((stock.marcap % 1000000000000) / 100000000);
                    marcapStr = jo > 0 ? \`\${jo}조 \${eok}억원\` : \`\${eok}억원\`;
                }

                tr.innerHTML = `
                    <td>
                        <div class="theme-name-cell">
                            <span class="stock-name" style="font-weight: 600;">${stock.name}</span>
                            <span style="font-size: 11px; color: var(--text-muted); margin-left: 5px;">${stock.code}</span>
                        </div>
                    </td>
                    <td class="right"><span class="price-main" style="color: white;">${price}</span></td>
                    <td class="right"><span class="${day3Class} price-main">${day3Sign}${day3}%</span></td>
                    <td class="right"><span class="price-main"><span class="pos">+${high52}%</span> / <span class="neg">${low52}%</span></span></td>
                    <td class="center"><span class="price-main" style="color: var(--text-main); font-weight: 800;">${neglect52}</span></td>
                    <td class="right"><span class="price-main"><span class="pos">+${high3y}%</span> / <span class="neg">${low3y}%</span></span></td>
                    <td class="center"><span class="price-main" style="color: var(--text-main); font-weight: 800;">${neglect3y}</span></td>
                    <td class="right" style="background-color: rgba(255,255,255,0.03);">
                        <span class="price-main" style="font-weight: 800; color: var(--text-main);">${expRet}%</span>
                    </td>
                    <td class="right"><span class="price-main">${pbr}</span></td>
                    <td class="right"><span class="price-main">${per}</span></td>
                    <td class="right"><span class="price-main">${eps}</span></td>
                    <td class="right"><span class="price-main" style="font-size: 12px; color: var(--text-muted);">${marcapStr}</span></td>
                `;
                tbody.appendChild(tr);
            });
            
            // Add back button row
            const backTr = document.createElement('tr');
            backTr.innerHTML = `
                <td colspan="12" class="center">
                    <button id="back-to-themes" style="padding: 10px 20px; background: var(--bg-card); color: white; border: 1px solid var(--border-color); border-radius: 5px; cursor: pointer; font-family: inherit;">
                        <i class="ph ph-arrow-left"></i> 테마 리스트로 돌아가기
                    </button>
                </td>
            `;
            tbody.appendChild(backTr);
            
            document.getElementById('back-to-themes').addEventListener('click', () => {
                headerTitle.textContent = "전체 테마";
                themeBadge.textContent = "테마";
                renderTable(window.allThemes, 'themes');
            });
        }
    }

    function loadThemeDetails(themeName) {
        headerTitle.textContent = themeName + " 테마주";
        themeBadge.textContent = "테마상세";
        tbody.innerHTML = '<tr><td colspan="12" class="center" style="padding: 40px; color: var(--text-muted);">해당 테마의 종목 데이터를 불러오는 중입니다...</td></tr>';
        
        fetch(\`\${API_URL}/\${encodeURIComponent(themeName)}\`)
            .then(response => {
                if (!response.ok) throw new Error("Theme details not found");
                return response.json();
            })
            .then(data => {
                renderTable(data.stocks, 'stocks');
            })
            .catch(error => {
                console.error('Error fetching theme details:', error);
                tbody.innerHTML = '<tr><td colspan="12" class="center">상세 데이터를 불러오는 데 실패했습니다.</td></tr>';
                
                setTimeout(() => {
                    headerTitle.textContent = "전체 테마";
                    themeBadge.textContent = "테마";
                    renderTable(window.allThemes, 'themes');
                }, 2000);
            });
    }

    // 테마 메뉴 클릭 이벤트 처리
    const themeMenus = document.querySelectorAll('#theme-menu-list li');
    themeMenus.forEach(menu => {
        menu.addEventListener('click', (e) => {
            e.preventDefault();
            
            // 모든 메뉴의 active 클래스 제거 후 현재 클릭한 메뉴에 추가
            document.querySelectorAll('.menu-section li').forEach(li => li.classList.remove('active'));
            menu.classList.add('active');

            const action = menu.getAttribute('data-action');
            const menuText = menu.textContent.trim();
            
            // 제목 업데이트
            headerTitle.textContent = menuText;
            themeBadge.textContent = "테마";

            // 아직 데이터가 로딩되지 않았을 때 메뉴를 클릭하면 로딩 메시지 유지
            if (window.allThemes.length === 0) {
                tbody.innerHTML = '<tr><td colspan="12" class="center" style="padding: 40px; color: var(--text-muted);">데이터를 불러오는 중입니다...<br><span style="font-size: 13px;">(무료 서버 특성상 첫 접속 시 최대 1분 정도 소요될 수 있습니다)</span></td></tr>';
                return;
            }

            let filteredThemes = [...window.allThemes];

            // 필터링 및 정렬 로직
            if (action === 'rising') {
                filteredThemes = filteredThemes.filter(t => t.day1Pos);
            } else if (action === 'falling') {
                filteredThemes = filteredThemes.filter(t => !t.day1Pos);
            } else if (action === 'high-return') {
                filteredThemes.sort((a, b) => parseFloat(b.expReturn) - parseFloat(a.expReturn));
            } else if (action === 'neglected') {
                filteredThemes.sort((a, b) => parseFloat(b.neglect52) - parseFloat(a.neglect52));
            }

            renderTable(filteredThemes);
        });
    });

    // 조건별 종목 메뉴 클릭 이벤트 처리
    const stockMenus = document.querySelectorAll('#stock-menu-list li');
    stockMenus.forEach(menu => {
        menu.addEventListener('click', (e) => {
            e.preventDefault();
            
            document.querySelectorAll('.menu-section li').forEach(li => li.classList.remove('active'));
            menu.classList.add('active');

            const action = menu.getAttribute('data-action');
            const menuText = menu.textContent.trim();
            headerTitle.textContent = menuText;
            themeBadge.textContent = "종목";

            tbody.innerHTML = '<tr><td colspan="12" class="center" style="padding: 40px; color: var(--text-muted);">전 종목 데이터를 불러오는 중입니다...</td></tr>';

            fetch('https://dajavata-backend.onrender.com/api/stocks/fundamentals')
                .then(response => {
                    if (!response.ok) throw new Error("Stock data not found");
                    return response.json();
                })
                .then(data => {
                    let stocks = data.stocks || [];
                    
                    if (action === 'stock-rising') {
                        stocks = stocks.filter(s => s.day3 > 0).sort((a, b) => b.day3 - a.day3);
                    } else if (action === 'stock-falling') {
                        stocks = stocks.filter(s => s.day3 < 0).sort((a, b) => a.day3 - b.day3);
                    } else if (action === 'stock-low-pbr') {
                        stocks = stocks.filter(s => s.PBR > 0).sort((a, b) => a.PBR - b.PBR);
                    } else if (action === 'stock-low-per') {
                        stocks = stocks.filter(s => s.PER > 0).sort((a, b) => a.PER - b.PER);
                    } else if (action === 'stock-high-marcap') {
                        stocks = stocks.sort((a, b) => (b.marcap || 0) - (a.marcap || 0));
                    } else if (action === 'stock-high52') {
                        stocks = stocks.filter(s => s.high52 !== null && s.high52 < 5).sort((a, b) => (a.high52 || 0) - (b.high52 || 0));
                    }
                    
                    // 보여줄 종목 수를 100개로 제한하여 성능 확보
                    renderTable(stocks.slice(0, 100), 'stocks');
                })
                .catch(error => {
                    console.error('Error fetching stock data:', error);
                    tbody.innerHTML = '<tr><td colspan="12" class="center">종목 데이터를 불러오는 데 실패했습니다. (백엔드 서버 업데이트 필요)</td></tr>';
                });
        });
    });
});
