document.addEventListener('DOMContentLoaded', () => {
    const tbody = document.getElementById('table-body');
    const headerTitle = document.querySelector('.header-title h1');
    const themeBadge = document.querySelector('.theme-badge');
    
    // 모바일 햄버거 메뉴 토글
    const menuToggleBtn = document.getElementById('menu-toggle-btn');
    const sidebar = document.getElementById('sidebar');
    const sidebarOverlay = document.getElementById('sidebar-overlay');

    function openSidebar() {
        sidebar.classList.add('open');
        sidebarOverlay.classList.add('visible');
    }
    function closeSidebar() {
        sidebar.classList.remove('open');
        sidebarOverlay.classList.remove('visible');
    }

    if (menuToggleBtn) {
        menuToggleBtn.addEventListener('click', () => {
            sidebar.classList.contains('open') ? closeSidebar() : openSidebar();
        });
    }
    if (sidebarOverlay) {
        sidebarOverlay.addEventListener('click', closeSidebar);
    }

    // 모바일에서 메뉴 항목을 클릭하면 사이드바 자동으로 닫기
    document.querySelectorAll('.menu-section li').forEach(li => {
        li.addEventListener('click', () => {
            if (window.innerWidth <= 768) closeSidebar();
        });
    });

    // API URL
    const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:8001' : 'https://dajavata-backend.onrender.com';
    const API_URL = `${API_BASE}/api/themes`;
    const INSIGHTS_API_URL = `${API_BASE}/api/insights`;
    
    // Store fetched data globally for filtering
    window.allThemes = [];
    window.allStocks = [];
    window.allInsights = [];

    // 전체 종목 데이터를 로드하는 Promise (재사용/재시도 가능하게 함수로 분리)
    function loadAllStocks() {
        return fetch('https://dajavata-backend.onrender.com/api/stocks/fundamentals')
            .then(response => {
                if (!response.ok) throw new Error('fundamentals fetch failed');
                return response.json();
            })
            .then(data => {
                window.allStocks = data.stocks || [];
                return window.allStocks;
            })
            .catch(error => {
                console.error('Error fetching all stocks:', error);
                return []; // 실패해도 재시도할 수 있도록 캐싱하지 않음
            });
    }

    function loadInsights() {
        return fetch(INSIGHTS_API_URL)
            .then(response => {
                if (!response.ok) throw new Error('insights fetch failed');
                return response.json();
            })
            .then(data => {
                window.allInsights = data.posts || [];
                return window.allInsights;
            })
            .catch(error => {
                console.error('Error fetching insights:', error);
                return [];
            });
    }

    let allStocksPromise = loadAllStocks();

    // Pagination State
    let currentDataList = [];
    let currentMode = 'themes';
    let currentPage = 1;
    let isThemeDetail = false;
    const itemsPerPage = 50;

    const searchInput = document.querySelector('.search-box input');

    tbody.innerHTML = '<tr><td colspan="10" class="center" style="padding: 40px; color: var(--text-muted);">데이터를 불러오는 중입니다...<br><span style="font-size: 13px;">(무료 서버 특성상 첫 접속 시 최대 1분 정도 소요될 수 있습니다)</span></td></tr>';
    
    // Fetch data
    fetch(API_URL)
        .then(response => response.json())
        .then(data => {
            window.allThemes = data.themes || [];
            if (window.allThemes.length === 0) {
                tbody.innerHTML = '<tr><td colspan="10" class="center">데이터를 불러올 수 없습니다. API 연결을 확인해주세요.</td></tr>';
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
        searchInput.addEventListener('input', async () => {
            currentPage = 1;

            // 아직 전체 종목 데이터가 없으면, 로딩 중임을 표시하고 완료될 때까지 기다렸다가 검색
            if (window.allStocks.length === 0) {
                tbody.innerHTML = '<tr><td colspan="15" class="center" style="padding:40px;">종목 데이터를 불러오는 중입니다... 잠시만 기다려주세요.</td></tr>';
                window.allStocks = await allStocksPromise;

                // 실패했을 경우 재시도 (다음 입력을 기다리지 않고 즉시 재시도)
                if (window.allStocks.length === 0) {
                    allStocksPromise = loadAllStocks();
                }
            }
            
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

    // Helper functions for Notion Blocks
    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str || '';
        return div.innerHTML;
    }

    function blocksToHtml(blocks) {
        if (!blocks || blocks.length === 0) {
            return '<p style="color: var(--text-muted);">본문 내용이 없습니다.</p>';
        }
        
        let html = '';
        let listBuffer = null; // 'ul' | 'ol' | null
        
        function closeList() {
            if (listBuffer) {
                html += listBuffer === 'ul' ? '</ul>' : '</ol>';
                listBuffer = null;
            }
        }
        
        blocks.forEach(block => {
            if (block.type === 'bulleted_list_item') {
                if (listBuffer !== 'ul') { closeList(); html += '<ul style="margin:8px 0 16px 20px; padding:0;">'; listBuffer = 'ul'; }
                html += `<li style="margin-bottom:6px; color:var(--text-main);">${escapeHtml(block.text)}</li>`;
                return;
            }
            if (block.type === 'numbered_list_item') {
                if (listBuffer !== 'ol') { closeList(); html += '<ol style="margin:8px 0 16px 20px; padding:0;">'; listBuffer = 'ol'; }
                html += `<li style="margin-bottom:6px; color:var(--text-main);">${escapeHtml(block.text)}</li>`;
                return;
            }
            
            closeList();
            
            if (block.type === 'heading') {
                const sizes = { 1: '24px', 2: '20px', 3: '17px' };
                html += `<h${block.level} style="font-size:${sizes[block.level] || '17px'}; margin:24px 0 12px; color:white;">${escapeHtml(block.text)}</h${block.level}>`;
            } else if (block.type === 'paragraph') {
                html += `<p style="margin-bottom:14px; line-height:1.7; color: var(--text-main);">${escapeHtml(block.text).replace(/\n/g, '<br>')}</p>`;
            } else if (block.type === 'image') {
                html += `<figure style="margin:16px 0;">
                            <img src="${escapeHtml(block.url)}" style="max-width:100%; border-radius:8px;">
                            ${block.caption ? `<figcaption style="font-size:12px; color:var(--text-muted); margin-top:8px; text-align:center;">${escapeHtml(block.caption)}</figcaption>` : ''}
                         </figure>`;
            } else if (block.type === 'table') {
                html += '<table style="width:100%; border-collapse:collapse; margin:16px 0; font-size:14px; text-align:left;">';
                block.rows.forEach((row, i) => {
                    const isHeader = block.has_header && i === 0;
                    const tag = isHeader ? 'th' : 'td';
                    html += '<tr>';
                    row.forEach(cell => {
                        html += `<${tag} style="border:1px solid var(--border); padding:10px; color:var(--text-main);">${escapeHtml(cell)}</${tag}>`;
                    });
                    html += '</tr>';
                });
                html += '</table>';
            } else if (block.type === 'divider') {
                html += '<hr style="border:none; border-top:1px solid var(--border); margin:24px 0;">';
            }
        });
        
        closeList();
        return html;
    }

    function getBlocksText(blocks) {
        if (!blocks) return '';
        return blocks
            .filter(b => b.type === 'paragraph' || b.type === 'heading')
            .map(b => b.text)
            .join(' ');
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
            tbody.innerHTML = '<tr><td colspan="10" class="center" style="padding: 40px;">데이터가 없습니다.</td></tr>';
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
                    <td class="right"><span class="price-main">${pbr}</span></td>
                    <td class="right"><span class="price-main">${per}</span></td>
                    <td class="right"><span class="price-main">${eps}</span></td>
                    <td class="right"><span class="price-main" style="font-size: 12px; color: var(--text-muted);">${marcapStr}</span></td>
                `;
                tbody.appendChild(tr);
            });
        } else if (displayMode === 'insights') {
            thead.innerHTML = `
                <tr>
                    <th style="width: 15%">작성일</th>
                    <th style="width: 85%">시장 인사이트 칼럼</th>
                </tr>
            `;

            paginatedList.forEach(post => {
                const tr = document.createElement('tr');
                
                let rawText = getBlocksText(post.blocks);
                const textPreview = rawText.length > 200 ? rawText.substring(0, 200) + '...' : rawText;
                const formattedContent = escapeHtml(textPreview).replace(/\n/g, '<br>');
                
                tr.innerHTML = `
                    <td style="vertical-align: top; padding-top: 20px; color: var(--text-muted);">${post.date}</td>
                    <td style="padding: 20px 10px;">
                        <h3 style="margin-top: 0; margin-bottom: 10px; color: var(--text-main); font-size: 1.2rem;">${post.title}</h3>
                        <div style="line-height: 1.6; color: var(--text-muted); font-size: 0.95rem;">${formattedContent}</div>
                        <button class="read-more-btn" data-id="${post.id}" style="margin-top: 15px; background: transparent; border: 1px solid var(--border); color: var(--text-main); padding: 5px 15px; border-radius: 4px; cursor: pointer;">자세히 읽기</button>
                    </td>
                `;
                tbody.appendChild(tr);
            });

            // Bind read more buttons
            document.querySelectorAll('.read-more-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const id = e.target.getAttribute('data-id');
                    const post = window.allInsights.find(p => p.id === id);
                    if (post) {
                        renderSingleInsight(post);
                    }
                });
            });
        }

        // 4. 하단 컨트롤 버튼 (뒤로가기 + 페이지네이션)
        if (totalPages > 1 || isThemeDetail) {
            const footerTr = document.createElement('tr');
            
            let backButtonHtml = '';
            if (isThemeDetail) {
                backButtonHtml = `
                    <button id="back-to-themes" style="padding: 10px 20px; background: var(--bg-card); color: white; border: 1px solid var(--border); border-radius: 5px; cursor: pointer; font-family: inherit; margin-right: 20px;">
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
                <td colspan="15" class="center" style="padding: 20px 10px;">
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

    function renderSingleInsight(post) {
        headerTitle.textContent = post.title;
        themeBadge.textContent = "칼럼 전문";
        const thead = document.querySelector('#theme-table thead');
        thead.innerHTML = '';
        
        tbody.innerHTML = '';
        const tr = document.createElement('tr');
        const formattedContent = blocksToHtml(post.blocks);
        
        tr.innerHTML = `
            <td colspan="10" style="padding: 30px;">
                <div style="max-width: 800px; margin: 0 auto; line-height: 1.8; color: var(--text-main); font-size: 1.05rem;">
                    <div style="color: var(--text-muted); font-size: 0.9rem; margin-bottom: 20px;">작성일: ${post.date}</div>
                    ${formattedContent}
                </div>
            </td>
        `;
        tbody.appendChild(tr);

        // Add back button
        const footerTr = document.createElement('tr');
        footerTr.innerHTML = `
            <td colspan="10" class="center" style="padding: 20px;">
                <button id="back-to-insights" style="padding: 10px 20px; background: var(--bg-card); color: white; border: 1px solid var(--border); border-radius: 5px; cursor: pointer;">
                    <i class="ph ph-arrow-left"></i> 목록으로 돌아가기
                </button>
            </td>
        `;
        tbody.appendChild(footerTr);

        document.getElementById('back-to-insights').addEventListener('click', () => {
            headerTitle.textContent = "시장 인사이트 (칼럼)";
            themeBadge.textContent = "인사이트";
            renderTable(window.allInsights, 'insights');
        });
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

    // 인사이트 메뉴 클릭 이벤트
    const insightMenus = document.querySelectorAll('#insight-menu-list li');
    insightMenus.forEach(menu => {
        menu.addEventListener('click', async (e) => {
            e.preventDefault();
            document.querySelectorAll('.menu-section li').forEach(li => li.classList.remove('active'));
            menu.classList.add('active');

            const action = menu.getAttribute('data-action');
            headerTitle.textContent = menu.textContent.trim();
            themeBadge.textContent = "인사이트";

            tbody.innerHTML = '<tr><td colspan="10" class="center" style="padding: 40px; color: var(--text-muted);">노션에서 데이터를 불러오는 중입니다...</td></tr>';

            const insights = await loadInsights();

            // 헤더 먼저 업데이트
            const thead = document.querySelector('#theme-table thead');
            thead.innerHTML = `
                <tr>
                    <th style="width: 15%">작성일</th>
                    <th style="width: 85%">기업 개요 및 차트 분석</th>
                </tr>
            `;

            if (insights.length === 0) {
                tbody.innerHTML = '<tr><td colspan="10" class="center" style="padding: 40px;">등록된 글이 없거나 불러오지 못했습니다. 노션에 글을 작성해주세요.</td></tr>';
                return;
            }
            renderTable(insights, 'insights');
        });
    });
});
