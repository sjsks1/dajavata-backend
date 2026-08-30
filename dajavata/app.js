document.addEventListener('DOMContentLoaded', () => {
    const tbody = document.getElementById('table-body');
    const headerTitle = document.querySelector('.header-title h1');
    const themeBadge = document.querySelector('.theme-badge');
    
    // 紐⑤컮???꾨쾭嫄?硫붾돱 ?좉?
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

    // 紐⑤컮?쇱뿉??硫붾돱 ??ぉ???대┃?섎㈃ ?ъ씠?쒕컮 ?먮룞?쇰줈 ?リ린
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

    // ?꾩껜 醫낅ぉ ?곗씠?곕? 濡쒕뱶?섎뒗 Promise (?ъ궗???ъ떆??媛?ν븯寃??⑥닔濡?遺꾨━)
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
                return []; // ?ㅽ뙣?대룄 ?ъ떆?꾪븷 ???덈룄濡?罹먯떛?섏? ?딆쓬
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

    tbody.innerHTML = '<tr><td colspan="10" class="center" style="padding: 40px; color: var(--text-muted);">?곗씠?곕? 遺덈윭?ㅻ뒗 以묒엯?덈떎...<br><span style="font-size: 13px;">(臾대즺 ?쒕쾭 ?뱀꽦??泥??묒냽 ??理쒕? 1遺??뺣룄 ?뚯슂?????덉뒿?덈떎)</span></td></tr>';
    
    // Fetch data
    fetch(API_URL)
        .then(response => response.json())
        .then(data => {
            window.allThemes = data.themes || [];
            if (window.allThemes.length === 0) {
                tbody.innerHTML = '<tr><td colspan="10" class="center">?곗씠?곕? 遺덈윭?????놁뒿?덈떎. API ?곌껐???뺤씤?댁＜?몄슂.</td></tr>';
                return;
            }
            // 理쒖큹 ?묒냽 ???꾩껜 ?뚮쭏 ?뚮뜑留?
            renderTable(window.allThemes, 'themes');
        })
        .catch(error => {
            console.error('Error fetching themes:', error);
            tbody.innerHTML = '<tr><td colspan="12" class="center">?곗씠?곕? 遺덈윭?ㅻ뒗 以??ㅻ쪟媛 諛쒖깮?덉뒿?덈떎.</td></tr>';
        });

    // 寃?됱갹 ?대깽??
    if (searchInput) {
        searchInput.addEventListener('input', async () => {
            currentPage = 1;

            // ?꾩쭅 ?꾩껜 醫낅ぉ ?곗씠?곌? ?놁쑝硫? 濡쒕뵫 以묒엫???쒖떆?섍퀬 ?꾨즺???뚭퉴吏 湲곕떎?몃떎媛 寃??
            if (window.allStocks.length === 0) {
                tbody.innerHTML = '<tr><td colspan="15" class="center" style="padding:40px;">醫낅ぉ ?곗씠?곕? 遺덈윭?ㅻ뒗 以묒엯?덈떎... ?좎떆留?湲곕떎?ㅼ＜?몄슂.</td></tr>';
                window.allStocks = await allStocksPromise;

                // ?ㅽ뙣?덉쓣 寃쎌슦 ?ъ떆??(?ㅼ쓬 ?낅젰??湲곕떎由ъ? ?딄퀬 利됱떆 ?ъ떆??
                if (window.allStocks.length === 0) {
                    allStocksPromise = loadAllStocks();
                }
            }
            
            renderCurrentPage();
        });
    }

    // ?뚯씠釉??뚮뜑留?珥덇린???⑥닔
    function renderTable(dataList, mode = 'themes', fromThemeDetail = false) {
        currentDataList = dataList;
        currentMode = mode;
        currentPage = 1;
        isThemeDetail = fromThemeDetail;
        if (searchInput) searchInput.value = ''; // ???꾪솚 ??寃?됱뼱 珥덇린??
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
            return '<p style="color: var(--text-muted);">蹂몃Ц ?댁슜???놁뒿?덈떎.</p>';
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

    // ?꾩옱 ?섏씠吏 ?뚮뜑留?
    function renderCurrentPage() {
        const thead = document.querySelector('#theme-table thead');
        tbody.innerHTML = ''; // 珥덇린??

        // 1. 寃???꾪꽣留?
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
            tbody.innerHTML = '<tr><td colspan="10" class="center" style="padding: 40px;">?곗씠?곌? ?놁뒿?덈떎.</td></tr>';
            return;
        }

        // 2. ?섏씠吏?ㅼ씠??怨꾩궛
        const totalPages = Math.ceil(filteredList.length / itemsPerPage);
        if (currentPage > totalPages) currentPage = totalPages;
        if (currentPage < 1) currentPage = 1;

        const startIndex = (currentPage - 1) * itemsPerPage;
        const paginatedList = filteredList.slice(startIndex, startIndex + itemsPerPage);

        // 3. ?ㅻ뜑 諛??곗씠???뚮뜑留?
        if (displayMode === 'themes') {
            thead.innerHTML = `
                <tr>
                    <th>?뚮쭏紐?/th>
                    <th class="right">?꾩씪鍮?/th>
                    <th class="right">3?쇳빀??/th>
                    <th class="right">52二??곸듅瑜?/th>
                    <th class="right">52二??섎씫瑜?/th>
                    <th class="center">52二??뚯쇅吏??/th>
                    <th class="right">3???곸듅瑜?/th>
                    <th class="right">3???섎씫瑜?/th>
                    <th class="center">3???뚯쇅吏??/th>
                    <th class="center">?낅뜲?댄듃</th>
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

            // ?뚮쭏 ?대쫫 ?대┃ ?대깽??諛붿씤??
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
                    <th>醫낅ぉ紐?/th>
                    <th class="right">?꾩옱媛寃?/th>
                    <th class="right">3?쇳빀??/th>
                    <th class="right">52二?理쒓퀬理쒖?</th>
                    <th class="center">52二??뚯쇅吏??/th>
                    <th class="right">3??理쒓퀬理쒖?</th>
                    <th class="center">3???뚯쇅吏??/th>
                    <th class="right">PBR</th>
                    <th class="right">PER</th>
                    <th class="right">EPS</th>
                    <th class="right">?쒓?珥앹븸</th>
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
                    marcapStr = jo > 0 ? `${jo}議?${eok}?듭썝` : `${eok}?듭썝`;
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
                    <th style="width: 15%">?묒꽦??/th>
                    <th style="width: 85%">?쒖옣 ?몄궗?댄듃 移쇰읆</th>
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
                        <button class="read-more-btn" data-id="${post.id}" style="margin-top: 15px; background: transparent; border: 1px solid var(--border); color: var(--text-main); padding: 5px 15px; border-radius: 4px; cursor: pointer;">?먯꽭???쎄린</button>
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

        // 4. ?섎떒 而⑦듃濡?踰꾪듉 (?ㅻ줈媛湲?+ ?섏씠吏?ㅼ씠??
        if (totalPages > 1 || isThemeDetail) {
            const footerTr = document.createElement('tr');
            
            let backButtonHtml = '';
            if (isThemeDetail) {
                backButtonHtml = `
                    <button id="back-to-themes" style="padding: 10px 20px; background: var(--bg-card); color: white; border: 1px solid var(--border); border-radius: 5px; cursor: pointer; font-family: inherit; margin-right: 20px;">
                        <i class="ph ph-arrow-left"></i> ?뚮쭏 由ъ뒪?몃줈 ?뚯븘媛湲?
                    </button>
                `;
            }

            let paginationHtml = '';
            if (totalPages > 1) {
                paginationHtml += `<div class="pagination-container" style="display: inline-flex; align-items: center; gap: 5px; margin: 0; padding: 0; background: transparent; border: none; box-shadow: none;">`;
                paginationHtml += `<button class="page-btn" ${currentPage === 1 ? 'disabled' : ''} data-page="prev">?댁쟾</button>`;
                
                let startPage = Math.max(1, currentPage - 2);
                let endPage = Math.min(totalPages, startPage + 4);
                if (endPage - startPage < 4) {
                    startPage = Math.max(1, endPage - 4);
                }

                for (let i = startPage; i <= endPage; i++) {
                    paginationHtml += `<button class="page-btn ${i === currentPage ? 'active' : ''}" data-page="${i}">${i}</button>`;
                }
                
                paginationHtml += `<button class="page-btn" ${currentPage === totalPages ? 'disabled' : ''} data-page="next">?ㅼ쓬</button>`;
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

            // ?대깽??諛붿씤??
            const backBtn = document.getElementById('back-to-themes');
            if (backBtn) {
                backBtn.addEventListener('click', () => {
                    headerTitle.textContent = "?꾩껜 ?뚮쭏";
                    themeBadge.textContent = "?뚮쭏";
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
                    
                    // ?뚯씠釉?留??꾨줈 ?ㅽ겕濡?
                    const tableContainer = document.querySelector('.table-container');
                    if (tableContainer) tableContainer.scrollTop = 0;
                });
            });
        }
    }

    function renderSingleInsight(post) {
        headerTitle.textContent = post.title;
        themeBadge.textContent = "移쇰읆 ?꾨Ц";
        const thead = document.querySelector('#theme-table thead');
        thead.innerHTML = '';
        
        tbody.innerHTML = '';
        const tr = document.createElement('tr');
        const formattedContent = blocksToHtml(post.blocks);
        
        tr.innerHTML = `
            <td colspan="10" style="padding: 30px;">
                <div style="max-width: 800px; margin: 0 auto; line-height: 1.8; color: var(--text-main); font-size: 1.05rem;">
                    <div style="color: var(--text-muted); font-size: 0.9rem; margin-bottom: 20px;">?묒꽦?? ${post.date}</div>
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
                    <i class="ph ph-arrow-left"></i> 紐⑸줉?쇰줈 ?뚯븘媛湲?
                </button>
            </td>
        `;
        tbody.appendChild(footerTr);

        document.getElementById('back-to-insights').addEventListener('click', () => {
            headerTitle.textContent = "?쒖옣 ?몄궗?댄듃 (移쇰읆)";
            themeBadge.textContent = "?몄궗?댄듃";
            renderTable(window.allInsights, 'insights');
        });
    }

    // ?뚮쭏 ?곸꽭 濡쒕뱶
    function loadThemeDetails(themeName) {
        headerTitle.textContent = themeName + " ?뚮쭏二?;
        themeBadge.textContent = "?뚮쭏?곸꽭";
        tbody.innerHTML = '<tr><td colspan="12" class="center" style="padding: 40px; color: var(--text-muted);">?대떦 ?뚮쭏??醫낅ぉ ?곗씠?곕? 遺덈윭?ㅻ뒗 以묒엯?덈떎...</td></tr>';
        
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
                tbody.innerHTML = '<tr><td colspan="12" class="center">?곸꽭 ?곗씠?곕? 遺덈윭?ㅻ뒗 ???ㅽ뙣?덉뒿?덈떎.</td></tr>';
                
                setTimeout(() => {
                    headerTitle.textContent = "?꾩껜 ?뚮쭏";
                    themeBadge.textContent = "?뚮쭏";
                    renderTable(window.allThemes, 'themes');
                }, 2000);
            });
    }

    // ?뚮쭏 硫붾돱 ?대┃ ?대깽??
    const themeMenus = document.querySelectorAll('#theme-menu-list li');
    themeMenus.forEach(menu => {
        menu.addEventListener('click', (e) => {
            e.preventDefault();
            document.querySelectorAll('.menu-section li').forEach(li => li.classList.remove('active'));
            menu.classList.add('active');

            const action = menu.getAttribute('data-action');
            headerTitle.textContent = menu.textContent.trim();
            themeBadge.textContent = "?뚮쭏";

            if (window.allThemes.length === 0) {
                tbody.innerHTML = '<tr><td colspan="12" class="center" style="padding: 40px; color: var(--text-muted);">?곗씠?곕? 遺덈윭?ㅻ뒗 以묒엯?덈떎...</td></tr>';
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

    // 議곌굔蹂?醫낅ぉ 硫붾돱 ?대┃ ?대깽??
    const stockMenus = document.querySelectorAll('#stock-menu-list li');
    stockMenus.forEach(menu => {
        menu.addEventListener('click', (e) => {
            e.preventDefault();
            document.querySelectorAll('.menu-section li').forEach(li => li.classList.remove('active'));
            menu.classList.add('active');

            const action = menu.getAttribute('data-action');
            headerTitle.textContent = menu.textContent.trim();
            themeBadge.textContent = "醫낅ぉ";

            tbody.innerHTML = '<tr><td colspan="12" class="center" style="padding: 40px; color: var(--text-muted);">??醫낅ぉ ?곗씠?곕? 遺덈윭?ㅻ뒗 以묒엯?덈떎...</td></tr>';

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
                    tbody.innerHTML = '<tr><td colspan="12" class="center">醫낅ぉ ?곗씠?곕? 遺덈윭?ㅻ뒗 ???ㅽ뙣?덉뒿?덈떎.</td></tr>';
                });
        });
    });

    // ?몄궗?댄듃 硫붾돱 ?대┃ ?대깽??
    const insightMenus = document.querySelectorAll('#insight-menu-list li');
    insightMenus.forEach(menu => {
        menu.addEventListener('click', async (e) => {
            e.preventDefault();
            document.querySelectorAll('.menu-section li').forEach(li => li.classList.remove('active'));
            menu.classList.add('active');

            const action = menu.getAttribute('data-action');
            headerTitle.textContent = menu.textContent.trim();
            themeBadge.textContent = "?몄궗?댄듃";

            tbody.innerHTML = '<tr><td colspan="10" class="center" style="padding: 40px; color: var(--text-muted);">?몄뀡?먯꽌 ?곗씠?곕? 遺덈윭?ㅻ뒗 以묒엯?덈떎...</td></tr>';

            const insights = await loadInsights();

            // ?ㅻ뜑 癒쇱? ?낅뜲?댄듃
            const thead = document.querySelector('#theme-table thead');
            thead.innerHTML = `
                <tr>
                    <th style="width: 15%">?묒꽦??/th>
                    <th style="width: 85%">湲곗뾽 媛쒖슂 諛?李⑦듃 遺꾩꽍</th>
                </tr>
            `;

            if (insights.length === 0) {
                tbody.innerHTML = '<tr><td colspan="10" class="center" style="padding: 40px;">?깅줉??湲???녾굅??遺덈윭?ㅼ? 紐삵뻽?듬땲?? ?몄뀡??湲???묒꽦?댁＜?몄슂.</td></tr>';
                return;
            }
            renderTable(insights, 'insights');
        });
    });
});
