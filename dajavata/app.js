document.addEventListener('DOMContentLoaded', () => {
    const tbody = document.getElementById('table-body');
    const headerTitle = document.querySelector('.header-title h1');
    const themeBadge = document.querySelector('.theme-badge');
    
    // API URL
    const API_URL = 'https://dajavata-backend.onrender.com/api/themes'; 
    
    // Store fetched data globally for filtering
    window.allThemes = [];
    window.allStocks = [];

    // Fetch all stocks globally for search
    fetch('https://dajavata-backend.onrender.com/api/stocks/fundamentals')
        .then(response => response.json())
        .then(data => {
            window.allStocks = data.stocks || [];
        })
        .catch(error => console.error('Error fetching all stocks:', error));

    // Pagination State
    let currentDataList = [];
    let currentMode = 'themes';
    let currentPage = 1;
    let isThemeDetail = false;
    const itemsPerPage = 50;

    const searchInput = document.querySelector('.search-box input');

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
            renderTable(window.allThemes, 'themes');
        })
        .catch(error => {
            console.error('Error fetching themes:', error);
            tbody.innerHTML = '<tr><td colspan="12" class="center">데이터를 불러오는 중 오류가 발생했습니다.</td></tr>';
        });

    // 검색창 이벤트
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            currentPage = 1;
            renderCurrentPage();
        });
    }

    // 테이블 렌더링 초기화 함수
    function renderTable(dataList, mode = 'themes', fromThemeDetail = false) {
        currentDataList = dataList;
        currentMode = mode;
        currentPage = 1;
        isThemeDetail = fromThemeDetail;
        if (searchInput) searchInput.value = ''; // 탭 전환 시 검색어 초기화
        renderCurrentPage();
    }

    // 현재 페이지 렌더링
    function renderCurrentPage() {
        const thead = document.querySelector('#theme-table thead');
        tbody.innerHTML = ''; // 초기화

        // 1. 검색 필터링
        let filteredList = currentDataList;
        let displayMode = currentMode;

        if (searchInput && searchInput.value.trim()) {
            const term = searchInput.value.toLowerCase().trim();
            
            let themeResults = window.allThemes.filter(item => {
                const name = (item.name || '').toLowerCase();
                const desc = (item.desc || '').toLowerCase();
                return name.includes(term) || desc.includes(term);
            });
            
            let stockResults = (window.allStocks && window.allStocks.length > 0) 
                ? window.allStocks.filter(item => {
                    const name = (item.name || '').toLowerCase();
                    const code = (item.code || '').toLowerCase();
                    return name.includes(term) || code.includes(term);
                }) 
                : currentDataList.filter(item => {
                    const name = (item.name || '').toLowerCase();
                    const code = (item.code || '').toLowerCase();
                    return name.includes(term) || code.includes(term);
                });
                
            if (themeResults.length > 0 && stockResults.length === 0) {
                filteredList = themeResults;
                displayMode = 'themes';
            } else if (stockResults.length > 0 && themeResults.length === 0) {
                filteredList = stockResults;
                displayMode = 'stocks';
            } else if (stockResults.length > 0 && themeResults.length > 0) {
                if (currentMode === 'themes') {
                    filteredList = themeResults;
                    displayMode = 'themes';
                } else {
                    filteredList = stockResults;
                    displayMode = 'stocks';
                }
            } else {
                filteredList = [];
                displayMode = currentMode;
            }
        }

        if (filteredList.length === 0) {
            tbody.innerHTML = '<tr><td colspan="15" class="center" style="padding: 40px;">데이터가 없습니다.</td></tr>';
            return;
        }

        // 2. 페이지네이션 계산
        const totalPages = Math.ceil(filteredList.length / itemsPerPage);
        if (currentPage > totalPages) currentPage = totalPages;
        if (currentPage < 1) currentPage = 1;

        const startIndex = (currentPage - 1) * itemsPerPage;
        const paginatedList = filteredList.slice(startIndex, startIndex + itemsPerPage);

        // 3. 헤더 및 데이터 렌더링
        if (displayMode === 'themes') {
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

            paginatedList.forEach(theme => {
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

            // 테마 이름 클릭 이벤트 바인딩
            document.querySelectorAll('.theme-link').forEach(link => {
                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    const themeName = e.target.getAttribute('data-theme-name');
                    loadThemeDetails(themeName);
                });
            });

        } else if (displayMode === 'stocks') {
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

            paginatedList.forEach(stock => {
                const tr = document.createElement('tr');
                
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
                
                let marcapStr = '-';
                if (stock.marcap) {
                    const jo = Math.floor(stock.marcap / 1000000000000);
                    const eok = Math.floor((stock.marcap % 1000000000000) / 100000000);
                    marcapStr = jo > 0 ? `${jo}조 ${eok}억원` : `${eok}억원`;
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
        }

        // 4. 하단 컨트롤 버튼 (뒤로가기 + 페이지네이션)
        if (totalPages > 1 || isThemeDetail) {
            const footerTr = document.createElement('tr');
            
            let backButtonHtml = '';
            if (isThemeDetail) {
                backButtonHtml = `
                    <button id="back-to-themes" style="padding: 10px 20px; background: var(--bg-card); color: white; border: 1px solid var(--border-color); border-radius: 5px; cursor: pointer; font-family: inherit; margin-right: 20px;">
                        <i class="ph ph-arrow-left"></i> 테마 리스트로 돌아가기
                    </button>
                `;
            }

            let paginationHtml = '';
            if (totalPages > 1) {
                paginationHtml += `<div class="pagination-container" style="display: inline-flex; align-items: center; gap: 5px; margin: 0; padding: 0; background: transparent; border: none; box-shadow: none;">`;
                paginationHtml += `<button class="page-btn" ${currentPage === 1 ? 'disabled' : ''} data-page="prev">이전</button>`;
                
                let startPage = Math.max(1, currentPage - 2);
                let endPage = Math.min(totalPages, startPage + 4);
                if (endPage - startPage < 4) {
                    startPage = Math.max(1, endPage - 4);
                }

                for (let i = startPage; i <= endPage; i++) {
                    paginationHtml += `<button class="page-btn ${i === currentPage ? 'active' : ''}" data-page="${i}">${i}</button>`;
                }
                
                paginationHtml += `<button class="page-btn" ${currentPage === totalPages ? 'disabled' : ''} data-page="next">다음</button>`;
                paginationHtml += `</div>`;
            }

            footerTr.innerHTML = `
                <td colspan="12" class="center" style="padding: 20px 10px;">
                    <div style="display: flex; justify-content: center; align-items: center;">
                        ${backButtonHtml}
                        ${paginationHtml}
                    </div>
                </td>
            `;
            tbody.appendChild(footerTr);

            // 이벤트 바인딩
            const backBtn = document.getElementById('back-to-themes');
            if (backBtn) {
                backBtn.addEventListener('click', () => {
                    headerTitle.textContent = "전체 테마";
                    themeBadge.textContent = "테마";
                    renderTable(window.allThemes, 'themes');
                });
            }

            footerTr.querySelectorAll('.page-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const page = e.target.getAttribute('data-page');
                    if (page === 'prev' && currentPage > 1) {
                        currentPage--;
                        renderCurrentPage();
                    } else if (page === 'next' && currentPage < totalPages) {
                        currentPage++;
                        renderCurrentPage();
                    } else if (!isNaN(page)) {
                        currentPage = parseInt(page);
                        renderCurrentPage();
                    }
                    
                    // 테이블 맨 위로 스크롤
                    const tableContainer = document.querySelector('.table-container');
                    if (tableContainer) tableContainer.scrollTop = 0;
                });
            });
        }
    }

    // 테마 상세 로드
    function loadThemeDetails(themeName) {
        headerTitle.textContent = themeName + " 테마주";
        themeBadge.textContent = "테마상세";
        tbody.innerHTML = '<tr><td colspan="12" class="center" style="padding: 40px; color: var(--text-muted);">해당 테마의 종목 데이터를 불러오는 중입니다...</td></tr>';
        
        fetch(`${API_URL}/${encodeURIComponent(themeName)}`)
            .then(response => {
                if (!response.ok) throw new Error("Theme details not found");
                return response.json();
            })
            .then(data => {
                renderTable(data.stocks, 'stocks', true);
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

    // 테마 메뉴 클릭 이벤트
    const themeMenus = document.querySelectorAll('#theme-menu-list li');
    themeMenus.forEach(menu => {
        menu.addEventListener('click', (e) => {
            e.preventDefault();
            document.querySelectorAll('.menu-section li').forEach(li => li.classList.remove('active'));
            menu.classList.add('active');

            const action = menu.getAttribute('data-action');
            headerTitle.textContent = menu.textContent.trim();
            themeBadge.textContent = "테마";

            if (window.allThemes.length === 0) {
                tbody.innerHTML = '<tr><td colspan="12" class="center" style="padding: 40px; color: var(--text-muted);">데이터를 불러오는 중입니다...</td></tr>';
                return;
            }

            let filteredThemes = [...window.allThemes];
            if (action === 'rising') filteredThemes = filteredThemes.filter(t => t.day1Pos);
            else if (action === 'falling') filteredThemes = filteredThemes.filter(t => !t.day1Pos);
            else if (action === 'high-return') filteredThemes.sort((a, b) => parseFloat(b.expReturn) - parseFloat(a.expReturn));
            else if (action === 'neglected') filteredThemes.sort((a, b) => parseFloat(b.neglect52) - parseFloat(a.neglect52));

            renderTable(filteredThemes, 'themes');
        });
    });

    // 조건별 종목 메뉴 클릭 이벤트
    const stockMenus = document.querySelectorAll('#stock-menu-list li');
    stockMenus.forEach(menu => {
        menu.addEventListener('click', (e) => {
            e.preventDefault();
            document.querySelectorAll('.menu-section li').forEach(li => li.classList.remove('active'));
            menu.classList.add('active');

            const action = menu.getAttribute('data-action');
            headerTitle.textContent = menu.textContent.trim();
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
                    
                    renderTable(stocks, 'stocks');
                })
                .catch(error => {
                    console.error('Error fetching stock data:', error);
                    tbody.innerHTML = '<tr><td colspan="12" class="center">종목 데이터를 불러오는 데 실패했습니다.</td></tr>';
                });
        });
    });
});
