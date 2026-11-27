/**
 * ============================================================================
 * DAJAVATA ALPHA LOUNGE & COLLECTIVE INTELLIGENCE NETWORK + ADMIN ANALYTICS v1.0
 * - 100% 다자바타 고유의 핀테크 터미널 아키텍처 (기존 기능과 완전 격리)
 * - 5대 핵심 시스템:
 *   1. 카카오 간편 로그인 & 5단계 알파 티어(루키~알파 마스터) + 인사이트 패스 지갑
 *   2. [알파 차트·시나리오 볼트] — AI 차트 스캐너 작도 & 트레이더 룸 플랜 공유 및 1클릭 가져오기
 *   3. [마켓 라운지] — 8대 주식·경제 채널, 추천 3+ 베스트 인사이트 상단 고정, 종목 태그 연동
 *   4. [종목·차트 리서치 의뢰소] — 인사이트 패스 리워드 현상금 & 베스트 리서치 채택 시스템
 *   5. [고객센터 & 파트너십 데스크] — 비밀글(🔒) 지원 및 운영 데스크 공식 답변 + 클라우드 백업
 *   6. [관리자 전용 방문자 & 유입경로 통계 센터] — Ctrl+Shift+A 관리자 로그인 시에만 독점 노출
 * ============================================================================
 */
(function () {
    'use strict';

    const API_BASE = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
        ? 'http://localhost:8001'
        : 'https://dajavata-backend.onrender.com';

    const USER_STORAGE_KEY = 'dajavata_alpha_user_v1';
    const COMMUNITY_CACHE_KEY = 'dajavata_alpha_community_db_clean_v2';
    const UNLOCKED_VAULT_KEY = 'dajavata_unlocked_vault_ids_v1';
    const LOCAL_ANALYTICS_KEY = 'dajavata_admin_analytics_real_v2';

    // 5단계 다자바타 알파 티어 정의 (전용 커스텀 벡터 엠블럼)
    const TIER_META = {
        1: { name: '루키 (Rookie)', minAp: 0, desc: '첫 트레이더 프로필 설정 완료', color: '#34d399', bg: 'rgba(16,185,129,0.16)' },
        2: { name: '애널리스트 (Analyst)', minAp: 5, desc: '알파 기여 5 AP 이상 달성', color: '#38bdf8', bg: 'rgba(56,189,248,0.16)' },
        3: { name: '스트래티지스트 (Strategist)', minAp: 15, desc: '알파 기여 15 AP 이상 달성', color: '#60a5fa', bg: 'rgba(59,130,246,0.2)' },
        4: { name: '펀드매니저 (Fund Manager)', minAp: 40, desc: '알파 기여 40 AP 이상 달성', color: '#c084fc', bg: 'rgba(168,85,247,0.2)' },
        5: { name: '알파 마스터 (Alpha Master)', minAp: 40, desc: '전체 상위 10% 톱티어 (40 AP 이상)', color: '#fbbf24', bg: 'rgba(245,158,11,0.22)' },
        9: { name: 'DAJAVATA 공식데스크', minAp: 999, desc: '다자바타 공식 리서치 & 운영 데스크', color: '#f43f5e', bg: 'rgba(244,63,94,0.22)' }
    };

    const LOUNGE_CHANNELS = [
        { id: 'ALL', label: '전체 라운지' },
        { id: 'kr-theme', label: '🇰🇷 국내 테마·수급' },
        { id: 'us-quant', label: '🇺🇸 미국 빅테크·퀀트' },
        { id: 'chart-setup', label: '📐 실전 차트·작도' },
        { id: 'macro', label: '🏦 매크로·금리·환율' },
        { id: 'journal', label: '💰 수익·복기 일지' },
        { id: 'qna', label: '💡 초보 투자 Q&A' },
        { id: 'free', label: '☕ 자유·멘탈 라운지' }
    ];

    const SUPPORT_CATEGORIES = {
        feature: '기능·테마 추가 제안',
        bug: '데이터·오류 제보',
        partner: '파트너십·광고 제휴',
        etc: '기타 이용 문의'
    };

    const state = {
        currentTab: 'community-vault', // 'community-vault' | 'community-lounge' | 'community-research' | 'community-support'
        db: null,
        user: null,
        unlockedIds: new Set(),
        // Vault filters
        vaultKind: 'ALL', // 'ALL' | 'chart' | 'scenario'
        vaultMarket: 'ALL', // 'ALL' | 'KR' | 'US'
        vaultSort: 'imports', // 'imports' | 'latest' | 'likes'
        vaultSearch: '',
        // Lounge filters
        loungeChannel: 'ALL',
        loungeSearch: '',
        // Research filters
        researchFilter: 'open', // 'open' | 'fulfilled' | 'mine'
        // Support filters
        supportFilter: 'ALL' // 'ALL' | 'feature' | 'bug' | 'partner' | 'mine'
    };

    function esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));
    }

    function notify(msg) {
        let toast = document.getElementById('dajavata-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'dajavata-toast';
            toast.style.cssText = 'position:fixed; bottom:30px; left:50%; transform:translateX(-50%); background:rgba(15,23,42,0.96); color:#fff; border:1px solid #3b82f6; padding:10px 22px; border-radius:8px; font-size:13px; font-weight:700; z-index:99999; box-shadow:0 8px 24px rgba(0,0,0,0.5); opacity:0; transition:opacity 0.2s ease; pointer-events:none;';
            document.body.appendChild(toast);
        }
        toast.textContent = msg;
        toast.style.opacity = '1';
        setTimeout(() => { toast.style.opacity = '0'; }, 2400);
    }

    // 커스텀 SVG 티어 엠블럼 렌더러
    function renderTierEmblem(tierNum, size = 18) {
        const t = Number(tierNum) || 1;
        const meta = TIER_META[t] || TIER_META[1];
        let innerSvg = '';
        if (t === 1) {
            innerSvg = `<circle cx="12" cy="12" r="9" fill="#064e3b" stroke="#34d399" stroke-width="2"/><path d="M12 7v10M8 11c2-2 6-2 8 0" stroke="#34d399" stroke-width="2" stroke-linecap="round"/>`;
        } else if (t === 2) {
            innerSvg = `<rect x="3" y="3" width="18" height="18" rx="5" fill="#0c4a6e" stroke="#38bdf8" stroke-width="2"/><path d="M7 15v-3M12 15V9M17 15V7" stroke="#38bdf8" stroke-width="2.2" stroke-linecap="round"/>`;
        } else if (t === 3) {
            innerSvg = `<polygon points="12,2 22,12 12,22 2,12" fill="#1e3a8a" stroke="#60a5fa" stroke-width="2"/><path d="M13 7l-4 5h3l-1 5 5-6h-3l0-4z" fill="#93c5fd"/>`;
        } else if (t === 4) {
            innerSvg = `<polygon points="12,2 21,7 21,17 12,22 3,17 3,7" fill="#3b0764" stroke="#c084fc" stroke-width="2"/><polygon points="12,6 17,12 12,18 7,12" fill="#e9d5ff"/>`;
        } else if (t === 5) {
            innerSvg = `<rect x="2" y="2" width="20" height="20" rx="6" fill="#451a03" stroke="#fbbf24" stroke-width="2"/><path d="M5 16l2-7 5 4 5-4 2 7H5z" fill="#fbbf24"/>`;
        } else {
            innerSvg = `<rect x="2" y="2" width="20" height="20" rx="6" fill="#4c0519" stroke="#f43f5e" stroke-width="2"/><path d="M12 5l2.2 4.5 5 .7-3.6 3.5.9 4.9-4.5-2.4-4.5 2.4.9-4.9-3.6-3.5 5-.7L12 5z" fill="#fb7185"/>`;
        }
        return `<span style="display:inline-flex; align-items:center; vertical-align:middle;" title="${esc(meta.name)}"><svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" aria-hidden="true">${innerSvg}</svg></span>`;
    }

    function renderTierBadge(tierNum) {
        const t = Number(tierNum) || 1;
        const meta = TIER_META[t] || TIER_META[1];
        return `<span style="display:inline-flex; align-items:center; gap:4px; padding:2px 7px; border-radius:5px; font-size:11px; font-weight:700; background:${meta.bg}; color:${meta.color}; border:1px solid ${meta.color}44;">${renderTierEmblem(t, 13)}<span>${esc(meta.name.split(' ')[0])}</span></span>`;
    }

    // 로컬 유저 로드 및 일일 무료 패스(3개) 자동 리필
    function loadCurrentUser() {
        try {
            const raw = localStorage.getItem(USER_STORAGE_KEY);
            if (raw) {
                const u = JSON.parse(raw);
                const today = new Date().toISOString().slice(0, 10);
                if (u.lastRefillDate !== today) {
                    u.lastRefillDate = today;
                    if ((Number(u.passes) || 0) < 3) u.passes = 3;
                    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(u));
                }
                state.user = u;
            }
            const unl = localStorage.getItem(UNLOCKED_VAULT_KEY);
            if (unl) {
                state.unlockedIds = new Set(JSON.parse(unl));
            }
        } catch (e) {}
    }

    function saveCurrentUser(u) {
        state.user = u;
        try {
            if (u) localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(u));
            else localStorage.removeItem(USER_STORAGE_KEY);
        } catch (e) {}
        syncHeaderAuthWidget();
    }

    // 커뮤니티 DB 로드 (백엔드 -> 로컬 정적 JSON -> GitHub Raw -> localStorage 오버레이)
    async function ensureCommunityDataLoaded() {
        let localOverride = null;
        try {
            localStorage.removeItem('dajavata_alpha_community_db_v1');
            const saved = localStorage.getItem(COMMUNITY_CACHE_KEY);
            if (saved) localOverride = JSON.parse(saved);
        } catch (e) {}

        const cb = Math.floor(Date.now() / 60000);
        const isAdm = sessionStorage.getItem('dajavata_admin') === '1';
        const uid = state.user ? state.user.id : '';
        const urls = [
            `${API_BASE}/api/community/data?user_id=${encodeURIComponent(uid)}&is_admin=${isAdm}`,
            `data/community_db.json?t=${cb}`,
            `https://raw.githubusercontent.com/sjsks1/dajavata-backend/main/data/community_db.json?t=${cb}`
        ];

        for (const u of urls) {
            try {
                const ctrl = new AbortController();
                const tid = setTimeout(() => ctrl.abort(), 2800);
                const r = await fetch(u, { cache: 'no-cache', signal: ctrl.signal });
                clearTimeout(tid);
                if (r.ok) {
                    const d = await r.json();
                    if (d && Array.isArray(d.vaultItems)) {
                        state.db = d;
                        break;
                    }
                }
            } catch (e) {}
        }

        if (!state.db && localOverride) {
            state.db = localOverride;
        }
        if (!state.db) {
            state.db = { profiles: {}, vaultItems: [], loungePosts: [], researchRequests: [], supportTickets: [] };
        }

        // 로컬에서 작성한 최신 항목이 있으면 병합 보존
        if (localOverride && state.db !== localOverride) {
            const mergeById = (baseArr, overArr) => {
                const map = new Map();
                (overArr || []).forEach(x => map.set(x.id, x));
                (baseArr || []).forEach(x => { if (!map.has(x.id)) map.set(x.id, x); });
                return Array.from(map.values());
            };
            state.db.vaultItems = mergeById(state.db.vaultItems, localOverride.vaultItems);
            state.db.loungePosts = mergeById(state.db.loungePosts, localOverride.loungePosts);
            state.db.researchRequests = mergeById(state.db.researchRequests, localOverride.researchRequests);
            state.db.supportTickets = mergeById(state.db.supportTickets, localOverride.supportTickets);
            state.db.profiles = { ...(state.db.profiles || {}), ...(localOverride.profiles || {}) };
        }

        if (state.user) {
            state.db.profiles[state.user.id] = {
                ...(state.db.profiles[state.user.id] || {}),
                ...state.user
            };
        }
        recomputeAllTiers();
        saveLocalCommunityDb();
        return state.db;
    }

    function saveLocalCommunityDb() {
        if (!state.db) return;
        try {
            localStorage.setItem(COMMUNITY_CACHE_KEY, JSON.stringify(state.db));
        } catch (e) {}
    }

    function recomputeAllTiers() {
        if (!state.db || !state.db.profiles) return;
        const pmap = state.db.profiles;
        const candidates = [];
        Object.keys(pmap).forEach(uid => {
            const p = pmap[uid];
            if (uid === 'official_desk' || Number(p.tier) === 9) {
                p.tier = 9;
                return;
            }
            const ap = Number(p.ap) || 0;
            if (ap >= 40) {
                p.tier = 4;
                candidates.push({ uid, ap });
            } else if (ap >= 15) p.tier = 3;
            else if (ap >= 5) p.tier = 2;
            else p.tier = 1;
        });
        candidates.sort((a, b) => b.ap - a.ap);
        const totalRegular = Math.max(1, Object.values(pmap).filter(p => Number(p.tier) !== 9).length);
        const topCount = Math.max(1, Math.round(totalRegular * 0.10));
        candidates.slice(0, topCount).forEach(c => {
            pmap[c.uid].tier = 5;
        });
        if (state.user && pmap[state.user.id]) {
            state.user.tier = pmap[state.user.id].tier;
            state.user.ap = pmap[state.user.id].ap;
            state.user.passes = pmap[state.user.id].passes;
        }
    }

    async function postCommunityApi(payload) {
        try {
            const r = await fetch(`${API_BASE}/api/community/action`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (r.ok) return await r.json();
        } catch (e) {}
        return null;
    }

    // 공통 모달 빌더
    function openModal(title, bodyHtml, isWide = false) {
        const existing = document.getElementById('al-dynamic-modal');
        if (existing) existing.remove();

        const backdrop = document.createElement('div');
        backdrop.id = 'al-dynamic-modal';
        backdrop.className = 'al-modal-backdrop';
        backdrop.innerHTML = `
            <div class="al-modal-box ${isWide ? 'wide' : ''}" role="dialog" aria-modal="true">
                <div class="al-modal-header">
                    <strong style="font-size:16px; color:#f8fafc;">${esc(title)}</strong>
                    <button type="button" class="al-ghost-btn" data-al-close>닫기 ✕</button>
                </div>
                <div class="al-modal-body">${bodyHtml}</div>
            </div>
        `;
        document.body.appendChild(backdrop);

        const close = () => backdrop.remove();
        backdrop.addEventListener('click', (e) => {
            if (e.target === backdrop || e.target.closest('[data-al-close]')) close();
        });
        backdrop.close = close;
        return backdrop;
    }

    // =========================================================================
    // 1. 카카오 간편 로그인 & 트레이더 프로필/클라우드 동기화 모달
    // =========================================================================
    function openKakaoLoginModal(onSuccessCallback) {
        const cur = state.user;
        const modal = openModal(
            cur ? '내 트레이더 프로필 & 카카오 계정 관리' : '카카오 1초 간편 시작 & 트레이더 프로필 설정',
            `
                <div style="background:rgba(16,185,129,0.12); border:1.5px solid rgba(16,185,129,0.55); border-radius:10px; padding:13px 16px; display:flex; align-items:flex-start; gap:11px; box-shadow:0 4px 16px rgba(16,185,129,0.12);">
                    <i class="ph-fill ph-shield-check" style="color:#34d399; font-size:22px; flex-shrink:0; margin-top:1px;"></i>
                    <div style="font-size:13px; color:#ecfdf5; line-height:1.55;">
                        <strong style="color:#34d399; font-size:13.5px; display:block; margin-bottom:2px;">🔒 다자바타는 실명·이메일·전화번호·비밀번호 등 어떠한 개인정보도 수집하거나 서버에 저장하지 않습니다 (익명 닉네임 기반)</strong>
                        <span style="color:#a7f3d0; font-size:12px;">오직 회원님이 직접 정한 <b>익명 별명(닉네임)</b>과 활동 포인트만 사용하므로 개인정보 유출이나 해킹 위험으로부터 100% 안전합니다.</span>
                    </div>
                </div>

                <div style="background:rgba(254,229,0,0.08); border:1px solid rgba(254,229,0,0.3); border-radius:10px; padding:12px 16px; display:flex; align-items:center; gap:12px;">
                    <div style="width:36px; height:36px; border-radius:9px; background:#FEE500; color:#191919; display:flex; align-items:center; justify-content:center; font-size:18px; font-weight:900; flex-shrink:0;">K</div>
                    <div style="font-size:12.5px; color:#e2e8f0; line-height:1.5;">
                        <strong>1초 익명 프로필 연결로 알파 라운지 & 트레이더 룸 동기화를 즉시 활성화합니다.</strong><br>
                        <span style="color:#94a3b8;">시작 즉시 <b>기본 3 패스(Pass)</b>가 지급되며, 매일 자정 무료 패스 3개가 자동 충전됩니다.</span>
                    </div>
                </div>

                <form id="al-kakao-login-form" style="display:flex; flex-direction:column; gap:12px; margin-top:4px;">
                    <div>
                        <label style="display:block; font-size:12px; font-weight:700; color:#94a3b8; margin-bottom:5px;">트레이더 익명 활동 닉네임 (필수 · 2~16자)</label>
                        <input type="text" id="al-login-nick" class="al-search-input" style="width:100%;" maxlength="16" required placeholder="예: 여의도퀀트킴, 반도체스나이퍼" value="${esc(cur ? cur.nickname : '')}">
                    </div>
                    <div>
                        <label style="display:block; font-size:12px; font-weight:700; color:#94a3b8; margin-bottom:5px;">기기 간 동기화용 익명 식별코드 (선택 — 개인정보가 아닌 나만의 영문/숫자 코드)</label>
                        <input type="text" id="al-login-email" class="al-search-input" style="width:100%;" maxlength="40" placeholder="예: alpha777 (집 PC·모바일에서 동일한 코드 입력 시 내 패스/백업 연동)" value="${esc(cur && cur.syncCode ? cur.syncCode : '')}">
                    </div>
                    <div>
                        <label style="display:block; font-size:12px; font-weight:700; color:#94a3b8; margin-bottom:5px;">주력 투자 분야 태그</label>
                        <select id="al-login-specialty" class="al-search-input" style="width:100%;">
                            <option value="국내 테마·수급 트레이더">🇰🇷 국내 테마·수급 트레이더</option>
                            <option value="미국 빅테크·퀀트 투자자">🇺🇸 미국 빅테크·퀀트 투자자</option>
                            <option value="ICT·엘리엇 차트 작도 전문가">📐 ICT·엘리엇 차트 작도 전문가</option>
                            <option value="배당·매크로 장기 투자자">🏦 배당·매크로 장기 투자자</option>
                        </select>
                    </div>
                    <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; margin-top:8px;">
                        ${cur ? `<button type="button" class="al-ghost-btn" id="al-btn-logout" style="color:#f87171; border-color:rgba(248,113,113,0.35);">로그아웃</button>` : `<span></span>`}
                        <button type="submit" class="al-kakao-btn" style="padding:10px 20px; font-size:13.5px;">
                            <i class="ph-fill ph-chat-circle-dots"></i> ${cur ? '익명 프로필 저장 및 동기화' : '카카오 간편 연결로 1초 시작하기'}
                        </button>
                    </div>
                </form>
            `
        );

        const logoutBtn = modal.querySelector('#al-btn-logout');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                saveCurrentUser(null);
                modal.close();
                render();
                notify('로그아웃되었습니다.');
            });
        }

        modal.querySelector('#al-kakao-login-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const nick = modal.querySelector('#al-login-nick').value.trim();
            const syncCode = modal.querySelector('#al-login-email').value.trim();
            const spec = modal.querySelector('#al-login-specialty').value;
            if (nick.length < 2) {
                notify('닉네임을 2글자 이상 입력해 주세요.');
                return;
            }
            const uid = syncCode ? ('kakao_' + syncCode.toLowerCase().replace(/[^a-z0-9]/g, '_')) : (cur ? cur.id : ('kakao_' + nick.replace(/\s+/g, '_')));
            const today = new Date().toISOString().slice(0, 10);
            const newProfile = {
                id: uid,
                nickname: nick,
                syncCode: syncCode,
                specialty: spec,
                provider: 'kakao',
                ap: cur ? (Number(cur.ap) || 1) : 1,
                passes: cur ? (Number(cur.passes) || 3) : 3,
                tier: cur ? (Number(cur.tier) || 1) : 1,
                lastRefillDate: today,
                joined_at: cur ? cur.joined_at : today
            };

            saveCurrentUser(newProfile);
            if (state.db) {
                state.db.profiles[uid] = newProfile;
                recomputeAllTiers();
                saveLocalCommunityDb();
            }
            await postCommunityApi({
                action: 'register_profile',
                userId: uid,
                nickname: nick,
                provider: 'kakao'
            });

            modal.close();
            render();
            notify(`환영합니다, ${nick}님! (보유 패스: ${newProfile.passes}개 · 알파 포인트: ${newProfile.ap} AP)`);
            if (typeof onSuccessCallback === 'function') onSuccessCallback(newProfile);
        });
    }

    // 5단계 알파 티어 & 인사이트 패스 안내 모달
    function openTierGuideModal() {
        const tierCards = [1, 2, 3, 4, 5].map(t => {
            const m = TIER_META[t];
            return `
                <div class="al-tier-card ${t === 5 ? 'master' : ''}">
                    ${renderTierEmblem(t, 38)}
                    <strong style="font-size:13px; color:${m.color};">${esc(m.name.split(' ')[0])}</strong>
                    <span style="font-size:11px; color:#94a3b8; line-height:1.35;">${esc(m.desc)}</span>
                </div>
            `;
        }).join('');

        openModal('다자바타 5단계 알파 티어 & 인사이트 패스 시스템 안내', `
            <div class="al-tier-grid">${tierCards}</div>
            <div style="background:rgba(15,23,42,0.7); border:1px solid rgba(148,163,184,0.16); border-radius:12px; padding:16px; display:flex; flex-direction:column; gap:10px; font-size:13px; line-height:1.65; color:#cbd5e1;">
                <div><strong style="color:#fbbf24;">👑 알파 마스터 (Alpha Master · 상위 10%)</strong>: 고정 점수가 아니라 펀드매니저 기준(40 AP) 이상 달성자 중 <b>실시간 알파 기여도 상위 10%</b>에게만 부여되는 최고 영예 등급입니다.</div>
                <div><strong style="color:#38bdf8;">⚡ 알파 포인트 (AP · Alpha Point)</strong>: 차트 작도나 매매 시나리오를 볼트에 공유하면 <b>+1 AP</b>, 다른 투자자가 내 작도/시나리오를 스캐너나 트레이더 룸으로 가져갈 때마다 <b>+1 AP</b>, 리서치 의뢰소에서 내 분석이 베스트로 채택되면 <b>+3 AP</b>가 누적됩니다.</div>
                <div><strong style="color:#fcd34d;">🎯 인사이트 패스 (Insight Pass)</strong>: 첫 프로필 등록 시 <b>3 패스</b>가 기본 지급되며, <b>매일 자정 무료 패스 3개가 자동 충전</b>됩니다(최대 3개까지). 내가 작도·시나리오를 공유할 때마다 <b>+1 패스</b>가 한도 없이 추가 적립되고, 리서치 의뢰 채택 보상으로 <b>+1~5 패스</b>를 획득할 수 있습니다.</div>
                <div><strong style="color:#34d399;">📥 스캐너 작도 적용 & 플랜 담기</strong>: 다른 투자자의 공유 작도나 시나리오를 처음 가져올 때만 <b>1 패스</b>가 사용되며, <b>한 번 잠금 해제한 자료는 다시 가져올 때 평생 무료</b>입니다.</div>
                <div style="display:flex; align-items:center; gap:8px; padding-top:6px; border-top:1px solid rgba(148,163,184,0.14);">
                    ${renderTierEmblem(9, 22)}
                    <span><strong style="color:#fb7185;">DAJAVATA 공식데스크</strong>: 다자바타 운영진 및 공식 리서치 데스크 전용 엠블럼이며 일반 회원 상위 10% 랭킹 산정에서는 제외됩니다.</span>
                </div>
            </div>
        `);
    }

    // 트레이더 룸 & 차트 작도 클라우드 백업/복원 모달
    function openCloudSyncModal() {
        if (!state.user) {
            openKakaoLoginModal(() => openCloudSyncModal());
            return;
        }
        const modal = openModal('☁️ 내 트레이더 룸 & 차트 작도 클라우드 동기화', `
            <div style="font-size:13px; color:#cbd5e1; line-height:1.6;">
                현재 연결된 계정(<strong style="color:#fbbf24;">${esc(state.user.nickname)}</strong> · ID: <code>${esc(state.user.id)}</code>)으로 브라우저의 <b>트레이더 룸 데이터(오늘의 관심종목, 매매 시나리오, 매매일지)</b>를 클라우드에 백업하거나 다른 기기(집 PC·회사 PC·모바일)에서 그대로 복원할 수 있습니다.
            </div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-top:6px;">
                <button type="button" class="al-primary-btn" id="al-cloud-push-btn" style="justify-content:center; padding:14px;">
                    <i class="ph-bold ph-cloud-arrow-up"></i> 현재 기기 데이터 클라우드 백업
                </button>
                <button type="button" class="al-ghost-btn" id="al-cloud-pull-btn" style="justify-content:center; padding:14px; border-color:#38bdf8; color:#38bdf8;">
                    <i class="ph-bold ph-cloud-arrow-down"></i> 클라우드 백업본 이 기기로 복원
                </button>
            </div>
            <div id="al-cloud-status" style="font-size:12.5px; color:#94a3b8; text-align:center; margin-top:4px;"></div>
        `);

        const statusEl = modal.querySelector('#al-cloud-status');
        modal.querySelector('#al-cloud-push-btn').addEventListener('click', async () => {
            statusEl.textContent = '클라우드 서버에 안전하게 백업 중입니다...';
            const traderRaw = localStorage.getItem('dajavata_trader_db_v1');
            const traderDb = traderRaw ? JSON.parse(traderRaw) : {};
            try {
                const r = await fetch(`${API_BASE}/api/trader/cloud-sync`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        mode: 'push',
                        userId: state.user.id,
                        nickname: state.user.nickname,
                        traderDb: traderDb
                    })
                });
                if (r.ok) {
                    const d = await r.json();
                    statusEl.innerHTML = `<span style="color:#34d399; font-weight:700;">✓ 클라우드 백업 완료! (${esc(d.updated_at)})</span>`;
                    notify('트레이더 룸 데이터가 클라우드에 백업되었습니다!');
                    return;
                }
            } catch (e) {}
            localStorage.setItem('dajavata_cloud_backup_' + state.user.id, JSON.stringify({ updated_at: new Date().toLocaleString('ko-KR'), traderDb }));
            statusEl.innerHTML = `<span style="color:#34d399; font-weight:700;">✓ 계정 동기화 스냅샷 저장 완료!</span>`;
            notify('계정 백업 스냅샷이 저장되었습니다.');
        });

        modal.querySelector('#al-cloud-pull-btn').addEventListener('click', async () => {
            statusEl.textContent = '클라우드 백업 데이터를 조회 중입니다...';
            try {
                const r = await fetch(`${API_BASE}/api/trader/cloud-sync`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ mode: 'pull', userId: state.user.id })
                });
                if (r.ok) {
                    const d = await r.json();
                    if (d && d.hasBackup && d.record && d.record.traderDb) {
                        localStorage.setItem('dajavata_trader_db_v1', JSON.stringify(d.record.traderDb));
                        statusEl.innerHTML = `<span style="color:#38bdf8; font-weight:700;">✓ 복원 완료! (백업 일시: ${esc(d.record.updated_at)})</span>`;
                        notify('클라우드 백업 데이터가 현재 기기의 트레이더 룸에 복원되었습니다!');
                        return;
                    }
                }
            } catch (e) {}
            const localSnap = localStorage.getItem('dajavata_cloud_backup_' + state.user.id);
            if (localSnap) {
                const parsed = JSON.parse(localSnap);
                localStorage.setItem('dajavata_trader_db_v1', JSON.stringify(parsed.traderDb));
                statusEl.innerHTML = `<span style="color:#38bdf8; font-weight:700;">✓ 스냅샷 복원 완료! (${esc(parsed.updated_at)})</span>`;
                notify('백업 스냅샷이 복원되었습니다!');
            } else {
                statusEl.innerHTML = `<span style="color:#f87171;">아직 이 계정으로 저장된 클라우드 백업이 없습니다. 먼저 [백업]을 눌러주세요.</span>`;
            }
        });
    }

    // =========================================================================
    // 2. [관리자 전용] 방문자 수 & 유입 경로(Referrer) 분석 엔진 (일반 방문자에게는 완전 비공개)
    // =========================================================================
    function classifyLocalReferrer(refUrl, utmSource) {
        const c = `${refUrl || ''} ${utmSource || ''}`.toLowerCase();
        if (!refUrl && !utmSource) return '직접 접속 / 북마크 (Direct)';
        if (c.includes('cafe.naver') || c.includes('blog.naver')) return '네이버 카페 · 블로그';
        if (c.includes('naver.com')) return '네이버 검색 (Naver)';
        if (c.includes('google.')) return '구글 검색 (Google)';
        if (c.includes('kakao') || c.includes('daum.net')) return '카카오톡 · 다음 (Kakao)';
        if (c.includes('youtube.com') || c.includes('youtu.be')) return '유튜브 (YouTube)';
        if (c.includes('instagram') || c.includes('threads') || c.includes('t.co') || c.includes('twitter')) return 'SNS (인스타·X·쓰레드)';
        if (c.includes('dcinside') || c.includes('fmkorea') || c.includes('clien') || c.includes('tradingview')) return '주식·투자 커뮤니티';
        if (c.includes('dajavata.com') || c.includes('localhost') || c.includes('127.0.0.1')) return '내부 메뉴 이동';
        return '기타 외부 링크 (Referral)';
    }

    function getOrInitLocalAnalytics() {
        try {
            localStorage.removeItem('dajavata_admin_analytics_v1');
            const raw = localStorage.getItem(LOCAL_ANALYTICS_KEY);
            if (raw) return JSON.parse(raw);
        } catch (e) {}

        // 100% 실제 수치만 집계: 모든 초기값을 0으로 시작 (가짜 시드 데이터 0건)
        const now = new Date();
        const daily = {};
        for (let i = 13; i >= 0; i--) {
            const d = new Date(now);
            d.setDate(now.getDate() - i);
            const k = d.toISOString().slice(0, 10);
            daily[k] = { uv: 0, pv: 0 };
        }
        const initObj = {
            daily,
            hourly: {},
            sources: {},
            views: {},
            devices: { 'PC Desktop': 0, 'Mobile / Tablet': 0 },
            recentVisits: []
        };
        try { localStorage.setItem(LOCAL_ANALYTICS_KEY, JSON.stringify(initObj)); } catch (e) {}
        return initObj;
    }

    function trackVisitorActivity(viewLabel, isInitialLanding = false) {
        try {
            const now = new Date();
            const dateStr = now.toISOString().slice(0, 10);
            const hrStr = String(now.getHours()).padStart(2, '0');
            const timeStr = now.toTimeString().slice(0, 8);
            const params = new URLSearchParams(window.location.search);
            const utm = params.get('utm_source') || params.get('ref') || '';

            // SPA 내부 탭 클릭 시 document.referrer가 최초 외부 주소로 고정되는 현상 방지:
            // 세션 최초 진입(isInitialLanding)일 때만 외부 document.referrer를 유입 경로로 인정하고,
            // 이후 사이트 내부 메뉴 클릭은 '내부 메뉴 이동'으로 정확히 기록
            const entryAlreadyTracked = sessionStorage.getItem('dajavata_entry_tracked') === '1';
            const isFirstEntry = isInitialLanding && !entryAlreadyTracked;
            if (isInitialLanding && !entryAlreadyTracked) {
                sessionStorage.setItem('dajavata_entry_tracked', '1');
            }

            const rawDocRef = document.referrer || '';
            const effectiveRef = isFirstEntry ? rawDocRef : `${window.location.origin}${window.location.pathname}`;
            const isMobile = /Mobile|Android|iPhone|iPad/i.test(navigator.userAgent);
            const device = isMobile ? 'Mobile / Tablet' : 'PC Desktop';
            const srcCat = isFirstEntry ? classifyLocalReferrer(rawDocRef, utm) : '내부 메뉴 이동';

            let vid = sessionStorage.getItem('dajavata_vid');
            let isNewDailyUv = false;
            if (!vid) {
                vid = 'v_' + Math.random().toString(36).slice(2, 10);
                sessionStorage.setItem('dajavata_vid', vid);
                isNewDailyUv = true;
            }

            const adb = getOrInitLocalAnalytics();
            if (!adb.daily[dateStr]) adb.daily[dateStr] = { uv: 0, pv: 0 };
            adb.daily[dateStr].pv += 1;
            if (isNewDailyUv) adb.daily[dateStr].uv += 1;

            adb.hourly[hrStr] = (Number(adb.hourly[hrStr]) || 0) + 1;
            if (isFirstEntry && srcCat !== '내부 메뉴 이동') {
                adb.sources[srcCat] = (Number(adb.sources[srcCat]) || 0) + 1;
            }
            const vName = viewLabel || '전체 테마';
            adb.views[vName] = (Number(adb.views[vName]) || 0) + 1;
            if (isFirstEntry || isNewDailyUv) {
                adb.devices[device] = (Number(adb.devices[device]) || 0) + 1;
            }

            const displayRef = isFirstEntry
                ? (rawDocRef || (utm ? `utm_source=${utm}` : '(직접 주소 입력 / 북마크)'))
                : `${window.location.origin}${window.location.pathname}${window.location.search}`;

            adb.recentVisits.unshift({
                time: `${dateStr} ${timeStr}`,
                visitorId: vid,
                source: srcCat,
                referrer: displayRef,
                view: vName,
                device: device
            });
            adb.recentVisits = adb.recentVisits.slice(0, 60);
            localStorage.setItem(LOCAL_ANALYTICS_KEY, JSON.stringify(adb));

            // 백엔드 서버에도 비동기 전송 (실제 방문 데이터만 기록)
            fetch(`${API_BASE}/api/analytics/track`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    visitorId: vid,
                    referrer: effectiveRef,
                    utmSource: isFirstEntry ? utm : '',
                    view: vName,
                    isEntry: isFirstEntry
                })
            }).catch(() => {});
        } catch (e) {}
    }

    async function openAdminAnalyticsModal() {
        const isAdmin = sessionStorage.getItem('dajavata_admin') === '1';
        if (!isAdmin) {
            notify('관리자 전용 기능입니다. (Ctrl+Shift+A 인증 필요)');
            return;
        }

        let data = null;
        try {
            const adminToken = sessionStorage.getItem('dajavata_admin_token') || '';
            const adminPin = sessionStorage.getItem('dajavata_admin_key') || '';
            const r = await fetch(`${API_BASE}/api/analytics/admin-summary`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: adminToken, pin: adminPin })
            });
            if (r.ok) {
                const srv = await r.json();
                if (srv && srv.ok) data = srv;
            }
        } catch (e) {}

        const localAdb = getOrInitLocalAnalytics();
        const dailyKeys = Object.keys(localAdb.daily).sort().slice(-14);
        const todayKey = dailyKeys[dailyKeys.length - 1] || new Date().toISOString().slice(0, 10);
        const yestKey = dailyKeys[dailyKeys.length - 2] || todayKey;

        const todayObj = data ? data.today : (localAdb.daily[todayKey] || { uv: 0, pv: 0 });
        const yestObj = data ? data.yesterday : (localAdb.daily[yestKey] || { uv: 0, pv: 0 });
        const dailySeries = data ? data.dailySeries : dailyKeys.map(k => ({ date: k, uv: (localAdb.daily[k] && localAdb.daily[k].uv) || 0, pv: (localAdb.daily[k] && localAdb.daily[k].pv) || 0 }));
        const sum7dUv = dailySeries.slice(-7).reduce((s, x) => s + x.uv, 0);
        const sum7dPv = dailySeries.slice(-7).reduce((s, x) => s + x.pv, 0);
        const sum14dUv = dailySeries.reduce((s, x) => s + x.uv, 0);
        const sum14dPv = dailySeries.reduce((s, x) => s + x.pv, 0);

        // 가짜 시드 폴백 완전 제거: 백엔드 실제 집계값(data.sources, data.views, data.devices)을 그대로 사용
        const sourcesMap = data ? (data.sources || {}) : (localAdb.sources || {});
        const sourceEntries = Object.entries(sourcesMap).filter(([, cnt]) => cnt > 0).sort((a, b) => b[1] - a[1]);
        const totalSrcHits = Math.max(1, sourceEntries.reduce((s, x) => s + x[1], 0));

        const viewsMap = data ? (data.views || {}) : (localAdb.views || {});
        const viewEntries = Object.entries(viewsMap).filter(([, cnt]) => cnt > 0).sort((a, b) => b[1] - a[1]);
        const totalViewHits = Math.max(1, viewEntries.reduce((s, x) => s + x[1], 0));

        const devicesMap = data ? (data.devices || {}) : (localAdb.devices || {});
        const pcCnt = Number(devicesMap['PC Desktop'] || 0);
        const mobCnt = Number(devicesMap['Mobile / Tablet'] || 0);
        const totDev = pcCnt + mobCnt;
        const pcPct = totDev > 0 ? Math.round((pcCnt / totDev) * 100) : 0;
        const mobPct = totDev > 0 ? (100 - pcPct) : 0;

        const maxDailyPv = Math.max(...dailySeries.map(x => x.pv || 1), 1);
        const recentLogs = data ? (data.recentVisits || []) : (localAdb.recentVisits || []);

        const modal = openModal('🛡️ DAJAVATA 관리자 전용 방문자 & 유입 경로(Referrer) 인텔리전스 센터', `
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; background:rgba(16,185,129,0.1); border:1px solid rgba(16,185,129,0.35); padding:10px 14px; border-radius:10px; font-size:12.5px; color:#34d399;">
                <span><i class="ph-fill ph-shield-check"></i> <strong>100% 실제 유입·방문 데이터만 집계합니다 (가짜 더미 수치 0건 · 일반 방문자 비공개)</strong></span>
                <div style="display:flex; align-items:center; gap:10px;">
                    <span style="font-family:monospace;">실시간 KST 트래킹 가동 중</span>
                    <button type="button" class="al-ghost-btn" id="al-btn-reset-analytics" style="padding:4px 10px; font-size:11.5px; color:#f87171; border-color:rgba(248,113,113,0.4);">🔄 누적 통계 0으로 초기화</button>
                </div>
            </div>

            <!-- 4대 핵심 방문자 KPI -->
            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:12px; font-variant-numeric:tabular-nums;">
                <div style="background:#101420; border:1px solid rgba(56,189,248,0.3); border-radius:12px; padding:14px 16px;">
                    <div style="font-size:11.5px; color:#94a3b8; font-weight:700;">오늘 순방문자 (Today UV / PV)</div>
                    <div style="font-size:22px; font-weight:800; color:#38bdf8; margin-top:4px;">${todayObj.uv.toLocaleString()}명 <span style="font-size:13px; color:#cbd5e1;">/ ${todayObj.pv.toLocaleString()} 뷰</span></div>
                    <div style="font-size:11px; color:#34d399; margin-top:3px;">1인당 평균 ${(todayObj.pv / Math.max(todayObj.uv, 1)).toFixed(1)}페이지 조회</div>
                </div>
                <div style="background:#101420; border:1px solid rgba(148,163,184,0.18); border-radius:12px; padding:14px 16px;">
                    <div style="font-size:11.5px; color:#94a3b8; font-weight:700;">어제 순방문자 (Yesterday)</div>
                    <div style="font-size:22px; font-weight:800; color:#f8fafc; margin-top:4px;">${yestObj.uv.toLocaleString()}명 <span style="font-size:13px; color:#94a3b8;">/ ${yestObj.pv.toLocaleString()} 뷰</span></div>
                    <div style="font-size:11px; color:#94a3b8; margin-top:3px;">전일 대비 ${todayObj.uv >= yestObj.uv ? '+' : ''}${todayObj.uv - yestObj.uv}명</div>
                </div>
                <div style="background:#101420; border:1px solid rgba(148,163,184,0.18); border-radius:12px; padding:14px 16px;">
                    <div style="font-size:11.5px; color:#94a3b8; font-weight:700;">최근 7일 누적 방문 (7D Total)</div>
                    <div style="font-size:22px; font-weight:800; color:#fbbf24; margin-top:4px;">${sum7dUv.toLocaleString()}명 <span style="font-size:13px; color:#cbd5e1;">/ ${sum7dPv.toLocaleString()} 뷰</span></div>
                    <div style="font-size:11px; color:#94a3b8; margin-top:3px;">일평균 ${Math.round(sum7dUv / 7).toLocaleString()}명 방문</div>
                </div>
                <div style="background:#101420; border:1px solid rgba(148,163,184,0.18); border-radius:12px; padding:14px 16px;">
                    <div style="font-size:11.5px; color:#94a3b8; font-weight:700;">접속 기기 비중 (PC vs 모바일)</div>
                    <div style="font-size:20px; font-weight:800; color:#c084fc; margin-top:4px;">PC ${pcPct}% · 모바일 ${mobPct}%</div>
                    <div style="font-size:11px; color:#94a3b8; margin-top:3px;">PC ${pcCnt}건 · 모바일 ${mobCnt}건 (누적 ${sum14dPv.toLocaleString()} PV)</div>
                </div>
            </div>

            <!-- 최근 14일 일별 방문자 추이 바 차트 -->
            <div style="background:#101420; border:1px solid rgba(148,163,184,0.16); border-radius:12px; padding:16px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                    <strong style="font-size:14px; color:#f8fafc;">📈 최근 14일 일별 순방문자(UV) & 페이지뷰(PV) 추이</strong>
                    <span style="font-size:11.5px; color:#94a3b8;">파랑: 순방문자(UV) · 하늘색: 페이지뷰(PV)</span>
                </div>
                <div style="display:grid; grid-template-columns:repeat(${dailySeries.length}, 1fr); gap:6px; align-items:end; height:145px; padding-top:16px;">
                    ${dailySeries.map(d => {
                        const hPx = d.pv > 0 ? Math.max(14, Math.round((d.pv / maxDailyPv) * 105)) : 6;
                        const uvPx = d.uv > 0 ? Math.max(8, Math.round((d.uv / maxDailyPv) * 105)) : 0;
                        return `
                            <div style="display:flex; flex-direction:column; align-items:center; gap:4px;" title="${d.date}: 순방문자 ${d.uv}명 / 페이지뷰 ${d.pv}뷰">
                                <span style="font-size:10px; font-weight:700; color:#38bdf8; font-variant-numeric:tabular-nums;">${d.uv}</span>
                                <div style="width:100%; max-width:26px; height:${hPx}px; background:rgba(56,189,248,0.22); border-radius:4px 4px 0 0; position:relative; display:flex; align-items:flex-end;">
                                    <div style="width:100%; height:${uvPx}px; background:linear-gradient(180deg, #3b82f6, #1d4ed8); border-radius:4px 4px 0 0;"></div>
                                </div>
                                <span style="font-size:10px; color:#64748b; font-family:monospace;">${d.date.slice(5)}</span>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>

            <!-- 2단 분석: 어디에서 타고 왔는가(유입 경로) + 어떤 메뉴를 가장 많이 봤는가(인기 탭) -->
            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(320px, 1fr)); gap:14px;">
                <div style="background:#101420; border:1px solid rgba(148,163,184,0.16); border-radius:12px; padding:16px;">
                    <strong style="font-size:14px; color:#f8fafc; display:block; margin-bottom:12px;">🧭 실제 유입 경로 분석 (어디에서 타고 홈페이지로 왔는가)</strong>
                    <div style="display:flex; flex-direction:column; gap:9px;">
                        ${sourceEntries.length > 0 ? sourceEntries.map(([srcName, cnt]) => {
                            const pct = ((cnt / totalSrcHits) * 100).toFixed(1);
                            return `
                                <div>
                                    <div style="display:flex; justify-content:space-between; font-size:12.5px; margin-bottom:4px;">
                                        <span style="font-weight:700; color:#e2e8f0;">${esc(srcName)}</span>
                                        <span style="font-family:monospace; color:#38bdf8; font-weight:700;">${cnt.toLocaleString()}건 (${pct}%)</span>
                                    </div>
                                    <div style="height:8px; background:rgba(148,163,184,0.12); border-radius:4px; overflow:hidden;">
                                        <div style="width:${Math.max(3, Math.round(pct))}%; height:100%; background:linear-gradient(90deg, #3b82f6, #38bdf8); border-radius:4px;"></div>
                                    </div>
                                </div>
                            `;
                        }).join('') : '<div style="font-size:12.5px; color:#64748b; padding:18px 0; text-align:center;">아직 집계된 외부 유입 데이터가 없습니다 (0건 · 방문 발생 시 실시간 반영)</div>'}
                    </div>
                </div>

                <div style="background:#101420; border:1px solid rgba(148,163,184,0.16); border-radius:12px; padding:16px;">
                    <strong style="font-size:14px; color:#f8fafc; display:block; margin-bottom:12px;">🔥 홈페이지 내 인기 메뉴 · 탭 TOP 순위</strong>
                    <div style="display:flex; flex-direction:column; gap:9px;">
                        ${viewEntries.length > 0 ? viewEntries.slice(0, 7).map(([vName, cnt]) => {
                            const pct = ((cnt / totalViewHits) * 100).toFixed(1);
                            return `
                                <div>
                                    <div style="display:flex; justify-content:space-between; font-size:12.5px; margin-bottom:4px;">
                                        <span style="font-weight:700; color:#e2e8f0;">${esc(vName)}</span>
                                        <span style="font-family:monospace; color:#fbbf24; font-weight:700;">${cnt.toLocaleString()}뷰 (${pct}%)</span>
                                    </div>
                                    <div style="height:8px; background:rgba(148,163,184,0.12); border-radius:4px; overflow:hidden;">
                                        <div style="width:${Math.max(3, Math.round(pct))}%; height:100%; background:linear-gradient(90deg, #f59e0b, #fbbf24); border-radius:4px;"></div>
                                    </div>
                                </div>
                            `;
                        }).join('') : '<div style="font-size:12.5px; color:#64748b; padding:18px 0; text-align:center;">아직 집계된 메뉴 조회 기록이 없습니다 (0뷰)</div>'}
                    </div>
                </div>
            </div>

            <!-- 실시간 최근 방문자 유입 상세 로그 -->
            <div style="background:#101420; border:1px solid rgba(148,163,184,0.16); border-radius:12px; padding:16px;">
                <strong style="font-size:14px; color:#f8fafc; display:block; margin-bottom:10px;">🕒 실시간 최근 방문자 & 상세 유입 주소(Referrer URL) 로그</strong>
                <div style="max-height:220px; overflow-y:auto;">
                    <table class="al-feed-table">
                        <thead>
                            <tr>
                                <th>방문 시각</th>
                                <th>유입 채널 분류</th>
                                <th>상세 유입 주소 (Referrer / 검색어 출처)</th>
                                <th>진입 메뉴</th>
                                <th>기기</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${recentLogs.slice(0, 30).map(lg => `
                                <tr>
                                    <td style="font-family:monospace; font-size:11.5px; color:#94a3b8;">${esc(lg.time)}</td>
                                    <td><span style="background:rgba(59,130,246,0.15); color:#93c5fd; padding:2px 7px; border-radius:4px; font-size:11px; font-weight:700;">${esc(lg.source)}</span></td>
                                    <td style="font-family:monospace; font-size:11.5px; color:#cbd5e1; max-width:260px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${esc(lg.referrer)}">${esc(lg.referrer)}</td>
                                    <td style="font-weight:700; color:#f8fafc;">${esc(lg.view)}</td>
                                    <td style="font-size:11.5px; color:#94a3b8;">${esc(lg.device)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `, true);

        const resetBtn = modal.querySelector('#al-btn-reset-analytics');
        if (resetBtn) {
            resetBtn.addEventListener('click', async () => {
                if (!confirm('지금까지 누적된 방문자 및 유입 경로 통계를 모두 0으로 초기화하시겠습니까?')) return;
                localStorage.removeItem(LOCAL_ANALYTICS_KEY);
                sessionStorage.removeItem('dajavata_entry_tracked');
                try {
                    const adminToken = sessionStorage.getItem('dajavata_admin_token') || '';
                    const adminPin = sessionStorage.getItem('dajavata_admin_key') || '';
                    await fetch(`${API_BASE}/api/analytics/admin-summary`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ token: adminToken, pin: adminPin, reset: true })
                    });
                } catch (e) {}
                modal.close();
                openAdminAnalyticsModal();
                notify('방문자 및 유입 경로 통계가 모두 0으로 초기화되었습니다.');
            });
        }
    }

    // 상단 기본 헤더(.header-meta-group)에 카카오 간편 로그인 & 관리자 전용 방문자 통계 버튼 주입
    function syncHeaderAuthWidget() {
        const metaGroup = document.querySelector('.header-meta-group');
        if (!metaGroup) return;

        let authSlot = document.getElementById('al-header-auth-slot');
        if (!authSlot) {
            authSlot = document.createElement('div');
            authSlot.id = 'al-header-auth-slot';
            authSlot.style.cssText = 'display:inline-flex; align-items:center; gap:8px;';
            metaGroup.insertBefore(authSlot, metaGroup.firstChild);
        }

        const isAdmin = sessionStorage.getItem('dajavata_admin') === '1';
        const adminAnalyticsBtnHtml = isAdmin
            ? `<button type="button" id="al-admin-analytics-trigger" style="display:inline-flex; align-items:center; gap:5px; background:rgba(16,185,129,0.18); border:1px solid #10b981; color:#34d399; padding:5px 11px; border-radius:6px; font-size:12px; font-weight:800; cursor:pointer; font-family:inherit;" title="관리자 전용 방문자 수 및 유입경로 대시보드 열기">
                <i class="ph-bold ph-chart-bar"></i> 방문자·유입 통계
               </button>`
            : '';

        if (!state.user) {
            authSlot.innerHTML = `
                ${adminAnalyticsBtnHtml}
                <button type="button" class="al-kakao-btn" id="al-header-kakao-btn" style="padding:5px 12px; font-size:12px;">
                    <i class="ph-fill ph-chat-circle-dots"></i> 카카오 로그인
                </button>
            `;
        } else {
            const u = state.user;
            authSlot.innerHTML = `
                ${adminAnalyticsBtnHtml}
                <button type="button" class="al-ghost-btn" id="al-header-user-btn" title="클릭하여 프로필 및 트레이더 룸 클라우드 동기화 열기" style="border-color:rgba(59,130,246,0.35);">
                    ${renderTierEmblem(u.tier || 1, 16)}
                    <span style="color:#fff; font-weight:800;">${esc(u.nickname)}</span>
                    <span style="color:#fcd34d; font-size:11.5px; font-weight:800;">🎯${Number(u.passes) || 0}</span>
                </button>
                <button type="button" class="al-ghost-btn" id="al-header-cloud-btn" title="트레이더 룸 데이터 클라우드 백업/복원" style="padding:5px 8px;">
                    <i class="ph-bold ph-cloud-arrow-up" style="color:#38bdf8;"></i>
                </button>
            `;
        }

        const kBtn = authSlot.querySelector('#al-header-kakao-btn');
        if (kBtn) kBtn.addEventListener('click', () => openKakaoLoginModal());
        const uBtn = authSlot.querySelector('#al-header-user-btn');
        if (uBtn) uBtn.addEventListener('click', () => openKakaoLoginModal());
        const cBtn = authSlot.querySelector('#al-header-cloud-btn');
        if (cBtn) cBtn.addEventListener('click', () => openCloudSyncModal());
        const admBtn = authSlot.querySelector('#al-admin-analytics-trigger');
        if (admBtn) admBtn.addEventListener('click', () => openAdminAnalyticsModal());
    }

    // =========================================================================
    // 3. 미니 핀테크 차트 SVG 생성기 (알파 볼트 각 카드의 시각적 작도 프리뷰)
    // =========================================================================
    function buildVaultMiniChartSvg(preview, stance) {
        const pts = (preview && Array.isArray(preview.candles) && preview.candles.length >= 4)
            ? preview.candles
            : [100, 103, 101, 106, 110, 108, 114, 117];
        const minV = Math.min(...pts) * 0.985;
        const maxV = Math.max(...pts) * 1.015;
        const span = Math.max(maxV - minV, 1);
        const W = 320, H = 92;

        const coords = pts.map((v, i) => {
            const x = 14 + (i / (pts.length - 1)) * (W - 28);
            const y = H - 12 - ((v - minV) / span) * (H - 24);
            return [Number(x.toFixed(1)), Number(y.toFixed(1))];
        });
        const lineD = coords.map((c, i) => `${i === 0 ? 'M' : 'L'}${c[0]},${c[1]}`).join(' ');
        const areaD = `${lineD} L${coords[coords.length - 1][0]},${H - 4} L${coords[0][0]},${H - 4} Z`;
        const mainColor = stance === 'BEAR' ? '#f43f5e' : (stance === 'NEUTRAL' ? '#f59e0b' : '#10b981');

        return `
            <svg viewBox="0 0 ${W} ${H}" style="width:100%; height:92px; display:block; overflow:visible;">
                <!-- 피보나치 0.618 황금 되돌림 존 & ICT 오더블록 박스 -->
                <rect x="14" y="${Math.round(H * 0.52)}" width="${W - 28}" height="16" fill="rgba(56,189,248,0.11)" stroke="rgba(56,189,248,0.3)" stroke-dasharray="3,3" rx="2"/>
                <text x="${W - 18}" y="${Math.round(H * 0.52) + 11}" fill="#38bdf8" font-size="9" font-weight="700" text-anchor="end">ICT OB · Fib 0.618</text>
                <line x1="14" y1="14" x2="${W - 14}" y2="14" stroke="rgba(16,185,129,0.45)" stroke-dasharray="4,3" stroke-width="1"/>
                <text x="18" y="11" fill="#34d399" font-size="8.5" font-weight="700">TARGET (TP1)</text>
                <path d="${areaD}" fill="${mainColor}1c"/>
                <path d="${lineD}" fill="none" stroke="${mainColor}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
                ${coords.map((c, idx) => idx === coords.length - 1 ? `<circle cx="${c[0]}" cy="${c[1]}" r="3.8" fill="${mainColor}" stroke="#fff" stroke-width="1.2"/>` : '').join('')}
            </svg>
        `;
    }

    // =========================================================================
    // 4. [모듈 1] 알파 차트·시나리오 볼트 렌더링 및 작도 공유/가져오기
    // =========================================================================
    function renderVaultTab() {
        const items = (state.db && state.db.vaultItems) ? state.db.vaultItems : [];
        const q = state.vaultSearch.trim().toLowerCase();

        let filtered = items.filter(it => {
            if (state.vaultKind !== 'ALL' && it.kind !== state.vaultKind) return false;
            const isKr = /^\d{6}$/.test(String(it.ticker || '')) || it.market === 'KOSPI' || it.market === 'KOSDAQ' || it.market === 'KRX';
            if (state.vaultMarket === 'KR' && !isKr) return false;
            if (state.vaultMarket === 'US' && isKr) return false;
            if (q) {
                const hay = `${it.ticker} ${it.stockName} ${it.title} ${it.summary} ${(it.tags || []).join(' ')} ${it.authorNick}`.toLowerCase();
                if (!hay.includes(q)) return false;
            }
            return true;
        });

        if (state.vaultSort === 'imports') {
            filtered.sort((a, b) => (Number(b.imports) || 0) - (Number(a.imports) || 0));
        } else if (state.vaultSort === 'likes') {
            filtered.sort((a, b) => (Number(b.likes) || 0) - (Number(a.likes) || 0));
        } else {
            filtered.sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
        }

        const fmtPx = (v, mkt, ticker) => {
            const n = Number(v) || 0;
            if (!n) return '-';
            const isKr = /^\d{6}$/.test(String(ticker || '')) || mkt === 'KOSPI' || mkt === 'KOSDAQ' || mkt === 'KRX';
            return isKr ? Math.round(n).toLocaleString('ko-KR') + '원' : '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        };

        return `
            <div class="al-toolbar">
                <div class="al-pill-group">
                    <button type="button" class="al-pill-btn ${state.vaultKind === 'ALL' ? 'active' : ''}" data-vault-kind="ALL">전체 (${items.length})</button>
                    <button type="button" class="al-pill-btn ${state.vaultKind === 'chart' ? 'active' : ''}" data-vault-kind="chart">📐 AI 스캐너 차트 작도</button>
                    <button type="button" class="al-pill-btn ${state.vaultKind === 'scenario' ? 'active' : ''}" data-vault-kind="scenario">📋 트레이더 룸 매매 시나리오</button>
                    <span style="width:1px; background:rgba(148,163,184,0.2); margin:0 4px;"></span>
                    <button type="button" class="al-pill-btn ${state.vaultMarket === 'ALL' ? 'active' : ''}" data-vault-mkt="ALL">한·미 전체</button>
                    <button type="button" class="al-pill-btn ${state.vaultMarket === 'KR' ? 'active' : ''}" data-vault-mkt="KR">🇰🇷 국내주식</button>
                    <button type="button" class="al-pill-btn ${state.vaultMarket === 'US' ? 'active' : ''}" data-vault-mkt="US">🇺🇸 미국주식</button>
                </div>
                <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                    <input type="text" id="al-vault-search" class="al-search-input" placeholder="종목명, 티커, 작도 기법(ICT/피보나치) 검색..." value="${esc(state.vaultSearch)}">
                    <select id="al-vault-sort" class="al-search-input" style="min-width:140px;">
                        <option value="imports" ${state.vaultSort === 'imports' ? 'selected' : ''}>많이 적용한 순</option>
                        <option value="likes" ${state.vaultSort === 'likes' ? 'selected' : ''}>추천 많은 순</option>
                        <option value="latest" ${state.vaultSort === 'latest' ? 'selected' : ''}>최신 등록 순</option>
                    </select>
                    <button type="button" class="al-primary-btn" id="al-btn-open-share-vault">
                        <i class="ph-bold ph-upload-simple"></i> + 내 작도·시나리오 공유 (+1 AP / +1 패스)
                    </button>
                </div>
            </div>

            <div class="al-vault-grid">
                ${filtered.length > 0 ? filtered.map(it => {
                    const stanceLabel = it.stance === 'BEAR' ? '🔴 매도/숏 관점' : (it.stance === 'NEUTRAL' ? '🟡 변곡점/관망' : '🟢 매수/롱 관점');
                    const isUnlocked = state.unlockedIds.has(it.id) || (state.user && state.user.id === it.authorId);
                    return `
                        <div class="al-vault-card">
                            <div class="al-vault-chart-box">
                                <div class="al-vault-top-tags">
                                    <div style="display:flex; align-items:center; gap:6px;">
                                        <span style="background:rgba(59,130,246,0.22); color:#93c5fd; font-weight:800; font-size:11px; padding:2px 7px; border-radius:4px; font-family:monospace;">${esc(it.ticker)}</span>
                                        <strong style="font-size:13px; color:#fff;">${esc(it.stockName)}</strong>
                                        <span style="font-size:11px; color:#94a3b8;">· ${esc(it.timeframe || '일봉')}</span>
                                    </div>
                                    <span class="al-stance-badge al-stance-${esc(it.stance || 'BULL')}">${stanceLabel}</span>
                                </div>
                                ${buildVaultMiniChartSvg(it.chartPreview, it.stance)}
                            </div>

                            <div class="al-vault-body">
                                <h3 class="al-vault-title">${esc(it.title)}</h3>
                                <p class="al-vault-summary">${esc(it.summary)}</p>

                                <div class="al-target-strip">
                                    <div class="al-target-cell">
                                        <span class="lbl">🎯 진입 타점 (ENTRY)</span>
                                        <span class="val" style="color:#38bdf8;">${fmtPx(it.entryPrice, it.market, it.ticker)}</span>
                                    </div>
                                    <div class="al-target-cell">
                                        <span class="lbl">🚀 목표가 (TARGET)</span>
                                        <span class="val" style="color:#34d399;">${fmtPx(it.targetPrice, it.market, it.ticker)}</span>
                                    </div>
                                    <div class="al-target-cell">
                                        <span class="lbl">✂️ 손절선 (STOP)</span>
                                        <span class="val" style="color:#f87171;">${fmtPx(it.stopPrice, it.market, it.ticker)}</span>
                                    </div>
                                </div>

                                <div style="display:flex; flex-wrap:wrap; gap:5px;">
                                    ${(it.tags || []).map(t => `<span style="font-size:11px; color:#93c5fd; background:rgba(59,130,246,0.1); padding:2px 7px; border-radius:4px;">#${esc(t)}</span>`).join('')}
                                    <span style="margin-left:auto; font-size:11px; font-weight:700; color:#fbbf24;">손익비 ${esc(it.rrRatio || '1 : 2.5')}</span>
                                </div>
                            </div>

                            <div class="al-vault-footer">
                                <div style="display:flex; align-items:center; gap:6px; font-size:12px; color:#94a3b8;">
                                    ${renderTierEmblem(it.authorTier || 1, 16)}
                                    <strong style="color:#e2e8f0;">${esc(it.authorNick)}</strong>
                                    <span>· 적용 <b style="color:#38bdf8;">${Number(it.imports) || 0}</b></span>
                                    <button type="button" class="al-ghost-btn" data-vault-like="${esc(it.id)}" style="padding:2px 7px; font-size:11.5px;">
                                        ♥ ${Number(it.likes) || 0}
                                    </button>
                                </div>
                                <div style="display:flex; align-items:center; gap:6px;">
                                    <button type="button" class="al-ghost-btn" data-vault-to-trader="${esc(it.id)}" title="트레이더 룸 [매매 시나리오]로 이 플랜 담기" style="padding:5px 9px; font-size:11.5px;">
                                        📥 플랜 담기
                                    </button>
                                    <button type="button" class="al-primary-btn" data-vault-import="${esc(it.id)}" style="padding:5px 11px; font-size:11.5px;">
                                        ⚡ 스캐너에 작도 적용 ${isUnlocked ? '(무료)' : '(1패스)'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    `;
                }).join('') : `<div style="grid-column:1 / -1; padding:48px 20px; text-align:center; color:#94a3b8; background:rgba(15,23,42,0.45); border:1px dashed rgba(148,163,184,0.22); border-radius:14px;">아직 등록된 차트 작도·시나리오가 없습니다. 우측 상단 <b style="color:#38bdf8;">[+ 내 작도·시나리오 공유]</b> 버튼을 눌러 첫 작도를 공유해 보세요!</div>`}
            </div>
        `;
    }

    function openShareVaultModal(prefill = {}) {
        if (!state.user) {
            openKakaoLoginModal(() => openShareVaultModal(prefill));
            return;
        }
        const modal = openModal('📐 내 AI 차트 작도 · 매매 시나리오 볼트 공유 (+1 AP & +1 패스 적립)', `
            <form id="al-share-vault-form" style="display:flex; flex-direction:column; gap:12px;">
                <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:10px;">
                    <div>
                        <label style="display:block; font-size:12px; font-weight:700; color:#94a3b8; margin-bottom:4px;">공유 유형</label>
                        <select id="al-sv-kind" class="al-search-input" style="width:100%;">
                            <option value="chart">📐 AI 스캐너 차트 작도</option>
                            <option value="scenario">📋 트레이더 룸 매매 시나리오</option>
                        </select>
                    </div>
                    <div>
                        <label style="display:block; font-size:12px; font-weight:700; color:#94a3b8; margin-bottom:4px;">종목코드 / 티커 (필수)</label>
                        <input type="text" id="al-sv-ticker" class="al-search-input" style="width:100%;" required placeholder="예: 005930 또는 NVDA" value="${esc(prefill.ticker || '')}">
                    </div>
                    <div>
                        <label style="display:block; font-size:12px; font-weight:700; color:#94a3b8; margin-bottom:4px;">종목명 (필수)</label>
                        <input type="text" id="al-sv-name" class="al-search-input" style="width:100%;" required placeholder="예: 삼성전자 또는 엔비디아" value="${esc(prefill.stockName || '')}">
                    </div>
                </div>

                <div style="display:grid; grid-template-columns:1fr 1fr 1fr 1fr; gap:10px;">
                    <div>
                        <label style="display:block; font-size:12px; font-weight:700; color:#94a3b8; margin-bottom:4px;">포지션 관점</label>
                        <select id="al-sv-stance" class="al-search-input" style="width:100%;">
                            <option value="BULL">🟢 매수 / 롱 (Bullish)</option>
                            <option value="BEAR">🔴 매도 / 숏 (Bearish)</option>
                            <option value="NEUTRAL">🟡 변곡점 / 관망</option>
                        </select>
                    </div>
                    <div>
                        <label style="display:block; font-size:12px; font-weight:700; color:#94a3b8; margin-bottom:4px;">진입 타점 (Entry)</label>
                        <input type="number" step="any" id="al-sv-entry" class="al-search-input" style="width:100%;" required placeholder="예: 192500" value="${esc(prefill.entryPrice || '')}">
                    </div>
                    <div>
                        <label style="display:block; font-size:12px; font-weight:700; color:#94a3b8; margin-bottom:4px;">목표가 (Target TP)</label>
                        <input type="number" step="any" id="al-sv-target" class="al-search-input" style="width:100%;" required placeholder="예: 218000" value="${esc(prefill.targetPrice || '')}">
                    </div>
                    <div>
                        <label style="display:block; font-size:12px; font-weight:700; color:#94a3b8; margin-bottom:4px;">손절선 (Stop SL)</label>
                        <input type="number" step="any" id="al-sv-stop" class="al-search-input" style="width:100%;" required placeholder="예: 184000" value="${esc(prefill.stopPrice || '')}">
                    </div>
                </div>

                <div>
                    <label style="display:block; font-size:12px; font-weight:700; color:#94a3b8; margin-bottom:4px;">작도 · 시나리오 제목 (필수)</label>
                    <input type="text" id="al-sv-title" class="al-search-input" style="width:100%;" maxlength="90" required placeholder="예: SK하이닉스 일봉 ICT 불리시 오더블록 & 피보나치 0.618 눌림목 스윙 작도" value="${esc(prefill.title || '')}">
                </div>

                <div>
                    <label style="display:block; font-size:12px; font-weight:700; color:#94a3b8; margin-bottom:4px;">핵심 작도 근거 & 매매 시나리오 설명</label>
                    <textarea id="al-sv-summary" class="al-search-input" style="width:100%; min-height:95px;" required placeholder="수급 근거, 지지/저항 매물대, 피보나치 비율, 무효화 손절 기준 등을 적어주세요.">${esc(prefill.summary || '')}</textarea>
                </div>

                <div>
                    <label style="display:block; font-size:12px; font-weight:700; color:#94a3b8; margin-bottom:4px;">검색 태그 (쉼표로 구분)</label>
                    <input type="text" id="al-sv-tags" class="al-search-input" style="width:100%;" placeholder="예: HBM4, ICT오더블록, 피보나치, 기관수급" value="${esc(prefill.tags || 'ICT오더블록, 피보나치, 스윙타점')}">
                </div>

                <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:6px;">
                    <button type="button" class="al-ghost-btn" data-al-close>취소</button>
                    <button type="submit" class="al-primary-btn">🚀 알파 볼트에 공유하고 +1 AP / +1 패스 받기</button>
                </div>
            </form>
        `);

        modal.querySelector('#al-share-vault-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const ticker = modal.querySelector('#al-sv-ticker').value.trim().toUpperCase();
            const stockName = modal.querySelector('#al-sv-name').value.trim();
            const kind = modal.querySelector('#al-sv-kind').value;
            const stance = modal.querySelector('#al-sv-stance').value;
            const entryP = parseFloat(modal.querySelector('#al-sv-entry').value) || 0;
            const targetP = parseFloat(modal.querySelector('#al-sv-target').value) || 0;
            const stopP = parseFloat(modal.querySelector('#al-sv-stop').value) || 0;
            const title = modal.querySelector('#al-sv-title').value.trim();
            const summary = modal.querySelector('#al-sv-summary').value.trim();
            const tags = modal.querySelector('#al-sv-tags').value.split(',').map(x => x.trim()).filter(Boolean).slice(0, 5);

            const risk = Math.abs(entryP - stopP);
            const reward = Math.abs(targetP - entryP);
            const rr = risk > 0 ? `1 : ${(reward / risk).toFixed(1)}` : '1 : 2.5';
            const isKr = /^\d{6}$/.test(ticker);

            const newItem = {
                id: 'vault-' + Date.now(),
                kind,
                ticker,
                stockName,
                market: isKr ? 'KOSPI' : 'NASDAQ',
                timeframe: prefill.timeframe || '일봉 (1D)',
                stance,
                title,
                summary,
                entryPrice: entryP,
                stopPrice: stopP,
                targetPrice: targetP,
                rrRatio: rr,
                authorId: state.user.id,
                authorNick: state.user.nickname,
                authorTier: state.user.tier || 1,
                imports: 0,
                likes: 0,
                tags,
                created_at: new Date().toISOString().slice(0, 16).replace('T', ' '),
                chartPreview: {
                    candles: [entryP * 0.94, entryP * 0.96, entryP * 0.95, entryP * 0.98, entryP, entryP * 0.99, entryP * 1.03, targetP * 0.98]
                },
                drawings: prefill.drawings || [
                    { type: 'hline', label: '추천 진입선 (ENTRY)', price: entryP },
                    { type: 'hline', label: '1차 목표선 (TARGET)', price: targetP },
                    { type: 'hline', label: '원칙 손절선 (STOP)', price: stopP }
                ]
            };

            state.db.vaultItems.unshift(newItem);
            state.user.ap = (Number(state.user.ap) || 0) + 1;
            state.user.passes = (Number(state.user.passes) || 0) + 1;
            state.db.profiles[state.user.id] = state.user;
            recomputeAllTiers();
            saveCurrentUser(state.user);
            saveLocalCommunityDb();

            await postCommunityApi({
                action: 'share_vault',
                ...newItem
            });

            modal.close();
            render();
            notify(`알파 볼트에 공유되었습니다! (+1 AP & +1 패스 적립 완료)`);
        });
    }

    async function handleImportVaultToScanner(itemId, toTraderRoom = false) {
        const it = (state.db.vaultItems || []).find(x => x.id === itemId);
        if (!it) return;

        if (!state.user) {
            openKakaoLoginModal(() => handleImportVaultToScanner(itemId, toTraderRoom));
            return;
        }

        const isMine = state.user.id === it.authorId;
        const alreadyUnlocked = state.unlockedIds.has(itemId) || isMine;

        if (!alreadyUnlocked) {
            if ((Number(state.user.passes) || 0) < 1) {
                notify('보유한 인사이트 패스가 부족합니다. 내 작도를 1건 공유하면 즉시 +1 패스가 충전됩니다!');
                return;
            }
            state.user.passes = Math.max(0, (Number(state.user.passes) || 0) - 1);
            state.unlockedIds.add(itemId);
            try {
                localStorage.setItem(UNLOCKED_VAULT_KEY, JSON.stringify(Array.from(state.unlockedIds)));
            } catch (e) {}
            it.imports = (Number(it.imports) || 0) + 1;
            if (it.authorId && state.db.profiles[it.authorId]) {
                state.db.profiles[it.authorId].ap = (Number(state.db.profiles[it.authorId].ap) || 0) + 1;
            }
            recomputeAllTiers();
            saveCurrentUser(state.user);
            saveLocalCommunityDb();
            postCommunityApi({ action: 'import_vault', itemId: it.id, userId: state.user.id });
        }

        if (toTraderRoom) {
            // 트레이더 룸 매매 시나리오(dajavata_trader_db_v1)로 즉시 복사 후 이동
            try {
                const rawTr = localStorage.getItem('dajavata_trader_db_v1');
                const trDb = rawTr ? JSON.parse(rawTr) : { plans: [], focusStocks: [], journal: [] };
                trDb.plans = trDb.plans || [];
                trDb.plans.unshift({
                    id: 'plan_' + Date.now(),
                    date: new Date().toISOString().slice(0, 10),
                    stockName: `${it.stockName} (${it.ticker})`,
                    market: it.market || 'KRX',
                    setup: `[알파 볼트] ${it.authorNick}님의 작도 시나리오`,
                    entryPrice: it.entryPrice,
                    stopPrice: it.stopPrice,
                    targetPrice: it.targetPrice,
                    notes: `${it.title}\n${it.summary}`,
                    status: 'planned'
                });
                localStorage.setItem('dajavata_trader_db_v1', JSON.stringify(trDb));
            } catch (e) {}

            if (window.TraderRoom && typeof window.TraderRoom.navigate === 'function') {
                const commContainer = document.getElementById('community-hub-container');
                if (commContainer) commContainer.style.display = 'none';
                window.TraderRoom.navigate('trader-plan');
                notify(`[${it.stockName}] 매매 시나리오가 내 트레이더 룸에 추가되었습니다!`);
            }
            return;
        }

        // AI 차트 스캐너로 이동 및 공유 작도 타점 오버레이 적용
        const commContainer = document.getElementById('community-hub-container');
        if (commContainer) commContainer.style.display = 'none';
        if (window.openInDajavataScanner) {
            window.openInDajavataScanner(it.ticker, it.stockName);
        } else if (window.ChartScanner && typeof window.ChartScanner.show === 'function') {
            window.ChartScanner.show();
            window.ChartScanner.selectStock(it.ticker, it.stockName);
        }
        renderVaultOverlayBannerOnScanner(it);
        notify(`[${it.stockName}] ${it.authorNick}님의 작도 타점(진입 ${it.entryPrice} / 목표 ${it.targetPrice} / 손절 ${it.stopPrice})이 스캐너에 적용되었습니다!`);
    }

    function renderVaultOverlayBannerOnScanner(it) {
        setTimeout(() => {
            const scannerContainer = document.getElementById('chart-scanner-container');
            if (!scannerContainer) return;
            let banner = document.getElementById('al-scanner-imported-banner');
            if (!banner) {
                banner = document.createElement('div');
                banner.id = 'al-scanner-imported-banner';
                banner.style.cssText = 'margin:8px 14px 0; padding:10px 16px; background:linear-gradient(90deg, rgba(37,99,235,0.22), rgba(16,185,129,0.16)); border:1px solid #3b82f6; border-radius:10px; display:flex; flex-wrap:wrap; justify-content:space-between; align-items:center; gap:10px; font-size:12.5px; color:#f8fafc; z-index:50;';
                scannerContainer.insertBefore(banner, scannerContainer.firstChild);
            }
            banner.innerHTML = `
                <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                    <span style="background:#2563eb; color:#fff; font-weight:800; font-size:11px; padding:2px 8px; border-radius:4px;">⚡ 알파 볼트 작도 적용됨</span>
                    <strong>[${esc(it.stockName)} · ${esc(it.ticker)}] ${esc(it.title)}</strong>
                    <span style="color:#94a3b8;">by ${esc(it.authorNick)}</span>
                </div>
                <div style="display:flex; align-items:center; gap:12px; font-family:monospace; font-weight:800;">
                    <span style="color:#38bdf8;">🎯 진입: ${Number(it.entryPrice).toLocaleString()}</span>
                    <span style="color:#34d399;">🚀 목표(TP): ${Number(it.targetPrice).toLocaleString()}</span>
                    <span style="color:#f87171;">✂️ 손절(SL): ${Number(it.stopPrice).toLocaleString()}</span>
                    <button type="button" onclick="this.parentElement.parentElement.remove()" style="background:transparent; border:none; color:#94a3b8; cursor:pointer; font-size:14px;">✕</button>
                </div>
            `;
        }, 160);
    }

    // =========================================================================
    // 5. [모듈 2] 마켓 라운지 (투자자 피드 & 종목 토론 · 추천 3+ 베스트 상단 고정)
    // =========================================================================
    function renderLoungeTab() {
        const posts = (state.db && state.db.loungePosts) ? state.db.loungePosts : [];
        const q = state.loungeSearch.trim().toLowerCase();

        // 추천 3개 이상 받은 베스트 인사이트 상위 5개 자동 추출
        const bestPosts = [...posts]
            .filter(p => (Number(p.likes) || 0) >= 3)
            .sort((a, b) => (Number(b.likes) || 0) - (Number(a.likes) || 0))
            .slice(0, 5);

        const filtered = posts.filter(p => {
            if (state.loungeChannel !== 'ALL' && p.channel !== state.loungeChannel) return false;
            if (q) {
                const hay = `${p.title} ${p.body} ${p.ticker} ${p.stockName} ${p.authorNick}`.toLowerCase();
                if (!hay.includes(q)) return false;
            }
            return true;
        });

        const chName = (cid) => (LOUNGE_CHANNELS.find(c => c.id === cid) || { label: cid }).label;

        return `
            <div class="al-toolbar">
                <div class="al-pill-group">
                    ${LOUNGE_CHANNELS.map(c => `
                        <button type="button" class="al-pill-btn ${state.loungeChannel === c.id ? 'active' : ''}" data-lounge-ch="${c.id}">
                            ${esc(c.label)}
                        </button>
                    `).join('')}
                </div>
                <div style="display:flex; align-items:center; gap:8px;">
                    <input type="text" id="al-lounge-search" class="al-search-input" placeholder="종목명, 티커, 키워드 검색..." value="${esc(state.loungeSearch)}">
                    <button type="button" class="al-primary-btn" id="al-btn-new-post">
                        <i class="ph-bold ph-pencil-simple"></i> 라운지 글쓰기
                    </button>
                </div>
            </div>

            ${bestPosts.length > 0 ? `
                <div class="al-best-box">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                        <strong style="font-size:13.5px; color:#fbbf24;">🔥 실시간 베스트 인사이트 (추천 3+ 상단 고정)</strong>
                        <span style="font-size:11.5px; color:#94a3b8;">집단지성이 검증한 핵심 수급·차트 분석글</span>
                    </div>
                    <div style="display:flex; flex-direction:column; gap:6px;">
                        ${bestPosts.map((bp, idx) => `
                            <div data-open-post="${esc(bp.id)}" style="display:flex; align-items:center; justify-content:space-between; gap:10px; padding:7px 10px; background:rgba(10,12,18,0.55); border-radius:8px; cursor:pointer;">
                                <div style="display:flex; align-items:center; gap:8px; min-width:0;">
                                    <span style="background:rgba(245,158,11,0.2); color:#fbbf24; font-weight:800; font-size:11px; padding:1px 6px; border-radius:4px;">BEST ${idx + 1}</span>
                                    ${bp.ticker ? `<span style="color:#38bdf8; font-family:monospace; font-weight:800; font-size:12px;">#${esc(bp.stockName || bp.ticker)}</span>` : ''}
                                    <strong style="font-size:13px; color:#f8fafc; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${esc(bp.title)}</strong>
                                </div>
                                <div style="display:flex; align-items:center; gap:10px; flex-shrink:0; font-size:12px; color:#94a3b8;">
                                    <span>${renderTierEmblem(bp.authorTier || 1, 14)} ${esc(bp.authorNick)}</span>
                                    <span style="color:#fb7185; font-weight:800;">♥ ${bp.likes}</span>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            ` : ''}

            <div class="qh-table-card">
                <table class="al-feed-table">
                    <thead>
                        <tr>
                            <th style="width:140px;">채널</th>
                            <th style="width:130px;">연관 종목</th>
                            <th>제목</th>
                            <th style="width:170px;">작성자</th>
                            <th style="width:120px; text-align:right;">작성시각</th>
                            <th style="width:80px; text-align:right;">추천</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filtered.length > 0 ? filtered.map(p => `
                            <tr data-open-post="${esc(p.id)}">
                                <td style="font-size:12px; color:#94a3b8; font-weight:600;">${esc(chName(p.channel))}</td>
                                <td>
                                    ${p.ticker ? `
                                        <span data-quick-ticker="${esc(p.ticker)}" data-quick-name="${esc(p.stockName || p.ticker)}" style="background:rgba(56,189,248,0.14); color:#38bdf8; border:1px solid rgba(56,189,248,0.3); padding:2px 7px; border-radius:5px; font-size:11.5px; font-weight:800; font-family:monospace;" title="클릭 시 해당 종목 AI 차트 스캐너 바로 열기">
                                            #${esc(p.stockName || p.ticker)} 📈
                                        </span>
                                    ` : '<span style="color:#64748b; font-size:12px;">일반</span>'}
                                </td>
                                <td>
                                    <strong style="color:#f8fafc; font-size:13.5px;">${esc(p.title)}</strong>
                                </td>
                                <td>
                                    <span style="display:inline-flex; align-items:center; gap:6px; font-size:12.5px; font-weight:700; color:#e2e8f0;">
                                        ${renderTierEmblem(p.authorTier || 1, 16)}
                                        <span>${esc(p.authorNick)}</span>
                                    </span>
                                </td>
                                <td style="text-align:right; font-family:monospace; font-size:12px; color:#94a3b8;">${esc(String(p.created_at || '').slice(5))}</td>
                                <td style="text-align:right; font-weight:800; color:${(Number(p.likes) || 0) >= 3 ? '#fb7185' : '#94a3b8'};">♥ ${Number(p.likes) || 0}</td>
                            </tr>
                        `).join('') : '<tr><td colspan="6" style="padding:40px; text-align:center; color:#64748b;">아직 등록된 라운지 게시글이 없습니다. 우측 상단 [라운지 글쓰기]를 눌러 첫 인사이트를 등록해 보세요!</td></tr>'}
                    </tbody>
                </table>
            </div>
        `;
    }

    function openLoungePostModal(postId) {
        const p = (state.db.loungePosts || []).find(x => x.id === postId);
        if (!p) return;
        p.views = (Number(p.views) || 0) + 1;
        saveLocalCommunityDb();

        const modal = openModal(p.title, `
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; padding-bottom:10px; border-bottom:1px solid rgba(148,163,184,0.14);">
                <div style="display:flex; align-items:center; gap:8px;">
                    ${renderTierBadge(p.authorTier || 1)}
                    <strong style="font-size:13.5px; color:#fff;">${esc(p.authorNick)}</strong>
                    <span style="font-size:12px; color:#64748b; font-family:monospace;">· ${esc(p.created_at)}</span>
                </div>
                <div style="display:flex; align-items:center; gap:8px;">
                    ${p.ticker ? `
                        <button type="button" class="al-ghost-btn" id="al-post-open-scanner" style="border-color:#38bdf8; color:#38bdf8;">
                            📈 #${esc(p.stockName || p.ticker)} AI 차트 열기
                        </button>
                    ` : ''}
                    <button type="button" class="al-primary-btn" id="al-post-like-btn" style="background:rgba(244,63,94,0.2); border:1px solid #f43f5e; color:#fb7185;">
                        ♥ 인사이트 추천 (${Number(p.likes) || 0})
                    </button>
                </div>
            </div>

            <div style="font-size:14px; line-height:1.75; color:#e2e8f0; white-space:pre-wrap; padding:8px 0 14px;">${esc(p.body)}</div>
        `);

        const scBtn = modal.querySelector('#al-post-open-scanner');
        if (scBtn) {
            scBtn.addEventListener('click', () => {
                modal.close();
                const commContainer = document.getElementById('community-hub-container');
                if (commContainer) commContainer.style.display = 'none';
                window.openInDajavataScanner(p.ticker, p.stockName);
            });
        }

        modal.querySelector('#al-post-like-btn').addEventListener('click', async () => {
            p.likes = (Number(p.likes) || 0) + 1;
            saveLocalCommunityDb();
            postCommunityApi({ action: 'like_item', targetType: 'lounge', targetId: p.id });
            modal.close();
            openLoungePostModal(p.id);
            render();
        });
    }

    function openNewLoungePostModal() {
        if (!state.user) {
            openKakaoLoginModal(() => openNewLoungePostModal());
            return;
        }
        const modal = openModal('💬 마켓 라운지 새 인사이트 작성', `
            <form id="al-new-post-form" style="display:flex; flex-direction:column; gap:12px;">
                <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:10px;">
                    <div>
                        <label style="display:block; font-size:12px; font-weight:700; color:#94a3b8; margin-bottom:4px;">라운지 채널</label>
                        <select id="al-np-channel" class="al-search-input" style="width:100%;">
                            ${LOUNGE_CHANNELS.filter(c => c.id !== 'ALL').map(c => `<option value="${c.id}">${esc(c.label)}</option>`).join('')}
                        </select>
                    </div>
                    <div>
                        <label style="display:block; font-size:12px; font-weight:700; color:#94a3b8; margin-bottom:4px;">연관 종목코드/티커 (선택)</label>
                        <input type="text" id="al-np-ticker" class="al-search-input" style="width:100%;" placeholder="예: 000660 또는 NVDA">
                    </div>
                    <div>
                        <label style="display:block; font-size:12px; font-weight:700; color:#94a3b8; margin-bottom:4px;">연관 종목명 (선택)</label>
                        <input type="text" id="al-np-name" class="al-search-input" style="width:100%;" placeholder="예: SK하이닉스">
                    </div>
                </div>
                <div>
                    <label style="display:block; font-size:12px; font-weight:700; color:#94a3b8; margin-bottom:4px;">제목 (필수)</label>
                    <input type="text" id="al-np-title" class="al-search-input" style="width:100%;" maxlength="100" required placeholder="핵심 수급 분석, 차트 관점, 매매 복기 제목을 입력하세요">
                </div>
                <div>
                    <label style="display:block; font-size:12px; font-weight:700; color:#94a3b8; margin-bottom:4px;">본문 내용</label>
                    <textarea id="al-np-body" class="al-search-input" style="width:100%; min-height:150px;" required placeholder="투자 인사이트와 근거를 자유롭게 공유해 주세요. (추천 3개 이상 획득 시 상단 BEST에 자동 고정됩니다)"></textarea>
                </div>
                <div style="display:flex; justify-content:flex-end; gap:10px;">
                    <button type="button" class="al-ghost-btn" data-al-close>취소</button>
                    <button type="submit" class="al-primary-btn">라운지에 등록하기</button>
                </div>
            </form>
        `);

        modal.querySelector('#al-new-post-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const ch = modal.querySelector('#al-np-channel').value;
            const ticker = modal.querySelector('#al-np-ticker').value.trim().toUpperCase();
            const stockName = modal.querySelector('#al-np-name').value.trim();
            const title = modal.querySelector('#al-np-title').value.trim();
            const body = modal.querySelector('#al-np-body').value.trim();

            const newP = {
                id: 'post-' + Date.now(),
                channel: ch,
                ticker,
                stockName,
                stance: 'BULL',
                title,
                body,
                authorId: state.user.id,
                authorNick: state.user.nickname,
                authorTier: state.user.tier || 1,
                likes: 0,
                views: 1,
                created_at: new Date().toISOString().slice(0, 16).replace('T', ' '),
                comments: []
            };
            state.db.loungePosts.unshift(newP);
            saveLocalCommunityDb();
            postCommunityApi({ action: 'create_post', ...newP });
            modal.close();
            render();
            notify('마켓 라운지에 새 글이 등록되었습니다!');
        });
    }

    // =========================================================================
    // 6. [모듈 3] 종목·차트 리서치 의뢰소 (인사이트 패스 현상금 & 채택 시스템)
    // =========================================================================
    function renderResearchTab() {
        const reqs = (state.db && state.db.researchRequests) ? state.db.researchRequests : [];
        const filtered = reqs.filter(r => {
            if (state.researchFilter === 'mine') return state.user && r.authorId === state.user.id;
            return r.status === state.researchFilter;
        });

        return `
            <div class="al-toolbar">
                <div class="al-pill-group">
                    <button type="button" class="al-pill-btn ${state.researchFilter === 'open' ? 'active' : ''}" data-req-filter="open">🔥 진행 중인 리서치 의뢰</button>
                    <button type="button" class="al-pill-btn ${state.researchFilter === 'fulfilled' ? 'active' : ''}" data-req-filter="fulfilled">🏆 채택 완료된 의뢰</button>
                    <button type="button" class="al-pill-btn ${state.researchFilter === 'mine' ? 'active' : ''}" data-req-filter="mine">📋 내가 올린 의뢰</button>
                </div>
                <button type="button" class="al-primary-btn" id="al-btn-new-request">
                    <i class="ph-bold ph-target"></i> + 종목·차트 분석 의뢰하기 (패스 현상금)
                </button>
            </div>

            <div style="display:flex; flex-direction:column; gap:12px;">
                ${filtered.map(r => `
                    <div class="al-vault-card" data-open-req="${esc(r.id)}" style="padding:16px 20px; cursor:pointer; flex-direction:row; justify-content:space-between; align-items:center; gap:16px; flex-wrap:wrap;">
                        <div style="display:flex; flex-direction:column; gap:6px; flex:1; min-width:260px;">
                            <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                                <span style="padding:2px 8px; border-radius:5px; font-size:11px; font-weight:800; background:${r.status === 'open' ? 'rgba(56,189,248,0.18)' : 'rgba(16,185,129,0.18)'}; color:${r.status === 'open' ? '#38bdf8' : '#34d399'};">
                                    ${r.status === 'open' ? '의뢰 진행 중' : '✓ 베스트 채택 완료'}
                                </span>
                                <span style="padding:2px 9px; border-radius:5px; font-size:11.5px; font-weight:800; background:rgba(245,158,11,0.2); color:#fbbf24; border:1px solid rgba(245,158,11,0.4);">
                                    🎯 리워드 현상금 ${Number(r.rewardPass) || 1} 패스 (+3 AP)
                                </span>
                                ${r.ticker ? `<span style="color:#93c5fd; font-family:monospace; font-weight:800; font-size:12px;">#${esc(r.stockName || r.ticker)}</span>` : ''}
                            </div>
                            <strong style="font-size:15px; color:#f8fafc;">${esc(r.title)}</strong>
                            <div style="font-size:12px; color:#94a3b8; display:flex; align-items:center; gap:8px;">
                                <span>의뢰인: ${renderTierEmblem(r.authorTier || 1, 14)} <b style="color:#cbd5e1;">${esc(r.authorNick)}</b></span>
                                <span>· ${esc(r.created_at)}</span>
                            </div>
                        </div>
                        <div style="display:flex; align-items:center; gap:12px;">
                            <span class="al-stat-pill">제출된 리서치 답변 ${(r.answers || []).length}건</span>
                        </div>
                    </div>
                `).join('') || '<div style="padding:40px; text-align:center; color:#64748b;">해당 조건의 리서치 의뢰가 없습니다.</div>'}
            </div>
        `;
    }

    function openResearchDetailModal(reqId) {
        const r = (state.db.researchRequests || []).find(x => x.id === reqId);
        if (!r) return;
        const isMine = state.user && state.user.id === r.authorId;
        const isOpen = r.status === 'open';
        const myVaults = (state.db.vaultItems || []).filter(v => state.user && v.authorId === state.user.id);

        const modal = openModal(`🎯 리서치 의뢰 상세 — ${r.title}`, `
            <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                <span style="padding:3px 9px; border-radius:5px; font-size:11.5px; font-weight:800; background:${isOpen ? 'rgba(56,189,248,0.18)' : 'rgba(16,185,129,0.18)'}; color:${isOpen ? '#38bdf8' : '#34d399'};">
                    ${isOpen ? '의뢰 진행 중' : '✓ 채택 완료'}
                </span>
                <span style="padding:3px 10px; border-radius:5px; font-size:12px; font-weight:800; background:rgba(245,158,11,0.2); color:#fbbf24;">
                    🎯 채택 리워드: ${Number(r.rewardPass) || 1} 패스 + 3 AP
                </span>
                <span style="font-size:12px; color:#94a3b8; margin-left:auto;">의뢰인: ${renderTierEmblem(r.authorTier || 1, 15)} ${esc(r.authorNick)} (${esc(r.created_at)})</span>
            </div>

            <div style="background:rgba(10,12,18,0.6); border:1px solid rgba(148,163,184,0.16); border-radius:10px; padding:14px 16px; font-size:13.5px; color:#e2e8f0; line-height:1.7; white-space:pre-wrap;">${esc(r.body)}</div>

            <div>
                <strong style="font-size:14px; color:#f8fafc; display:block; margin-bottom:10px;">📊 제출된 애널리스트 답변 (${(r.answers || []).length}건)</strong>
                <div style="display:flex; flex-direction:column; gap:10px;">
                    ${(r.answers || []).map(ans => `
                        <div style="background:${ans.isAccepted ? 'rgba(16,185,129,0.1)' : 'rgba(15,23,42,0.7)'}; border:1px solid ${ans.isAccepted ? '#10b981' : 'rgba(148,163,184,0.18)'}; border-radius:10px; padding:12px 14px; display:flex; justify-content:space-between; align-items:center; gap:12px; flex-wrap:wrap;">
                            <div style="flex:1; min-width:240px;">
                                <div style="display:flex; align-items:center; gap:6px; margin-bottom:4px;">
                                    ${ans.isAccepted ? '<span style="background:#10b981; color:#000; font-size:11px; font-weight:800; padding:1px 7px; border-radius:4px;">🏆 베스트 채택됨</span>' : ''}
                                    <strong style="font-size:13.5px; color:#38bdf8;">${esc(ans.vaultTitle)}</strong>
                                </div>
                                <div style="font-size:12.5px; color:#cbd5e1; margin-bottom:4px;">${esc(ans.comment)}</div>
                                <div style="font-size:11.5px; color:#94a3b8;">답변자: ${renderTierEmblem(ans.authorTier || 1, 14)} <b>${esc(ans.authorNick)}</b> · ${esc(ans.created_at)}</div>
                            </div>
                            <div style="display:flex; gap:8px;">
                                ${ans.vaultItemId ? `<button type="button" class="al-ghost-btn" data-ans-import="${esc(ans.vaultItemId)}">⚡ 작도 적용</button>` : ''}
                                ${(isMine && isOpen) ? `<button type="button" class="al-primary-btn" data-ans-accept="${esc(ans.id)}">🏆 이 답변 채택하기</button>` : ''}
                            </div>
                        </div>
                    `).join('') || '<div style="font-size:12.5px; color:#64748b;">아직 제출된 답변이 없습니다. 첫 리서치 답변을 등록해 현상금 패스를 획득하세요!</div>'}
                </div>
            </div>

            ${isOpen ? `
                <form id="al-req-answer-form" style="border-top:1px solid rgba(148,163,184,0.16); padding-top:14px; display:flex; flex-direction:column; gap:10px;">
                    <strong style="font-size:13.5px; color:#fbbf24;">✍️ 이 의뢰에 내 작도·리서치 답변 제출하기</strong>
                    <select id="al-ans-vault-id" class="al-search-input" style="width:100%;">
                        <option value="">(선택) 내가 알파 볼트에 공유한 차트 작도 연결하기</option>
                        ${myVaults.map(v => `<option value="${esc(v.id)}" data-title="${esc(v.title)}">[${esc(v.stockName)}] ${esc(v.title)}</option>`).join('')}
                    </select>
                    <textarea id="al-ans-comment" class="al-search-input" style="width:100%; min-height:75px;" required placeholder="핵심 지지/저항 타점 및 분석 요약을 작성해 주세요."></textarea>
                    <div style="display:flex; justify-content:flex-end;">
                        <button type="submit" class="al-primary-btn">리서치 답변 등록</button>
                    </div>
                </form>
            ` : ''}
        `);

        modal.querySelectorAll('[data-ans-import]').forEach(btn => {
            btn.addEventListener('click', () => {
                const vid = btn.getAttribute('data-ans-import');
                modal.close();
                handleImportVaultToScanner(vid, false);
            });
        });

        modal.querySelectorAll('[data-ans-accept]').forEach(btn => {
            btn.addEventListener('click', async () => {
                const aid = btn.getAttribute('data-ans-accept');
                const ans = (r.answers || []).find(a => a.id === aid);
                if (!ans) return;
                ans.isAccepted = true;
                r.status = 'fulfilled';
                r.acceptedAnswerId = aid;
                if (ans.authorId && state.db.profiles[ans.authorId]) {
                    state.db.profiles[ans.authorId].ap = (Number(state.db.profiles[ans.authorId].ap) || 0) + 3;
                    state.db.profiles[ans.authorId].passes = (Number(state.db.profiles[ans.authorId].passes) || 0) + (Number(r.rewardPass) || 1);
                }
                recomputeAllTiers();
                saveLocalCommunityDb();
                postCommunityApi({ action: 'accept_research_answer', requestId: r.id, answerId: aid });
                modal.close();
                render();
                notify(`답변이 채택되어 ${ans.authorNick}님에게 현상금 ${r.rewardPass} 패스와 +3 AP가 지급되었습니다!`);
            });
        });

        const ansForm = modal.querySelector('#al-req-answer-form');
        if (ansForm) {
            ansForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                if (!state.user) {
                    modal.close();
                    openKakaoLoginModal(() => openResearchDetailModal(r.id));
                    return;
                }
                const sel = modal.querySelector('#al-ans-vault-id');
                const vid = sel.value;
                const vTitle = vid ? sel.options[sel.selectedIndex].getAttribute('data-title') : `${r.stockName || r.ticker || '종목'} 맞춤 타점 리서치 답변`;
                const comment = modal.querySelector('#al-ans-comment').value.trim();
                const newAns = {
                    id: 'ans-' + Date.now(),
                    vaultItemId: vid,
                    vaultTitle: vTitle,
                    comment,
                    authorId: state.user.id,
                    authorNick: state.user.nickname,
                    authorTier: state.user.tier || 1,
                    created_at: new Date().toISOString().slice(0, 16).replace('T', ' '),
                    isAccepted: false
                };
                r.answers = r.answers || [];
                r.answers.push(newAns);
                saveLocalCommunityDb();
                postCommunityApi({ action: 'submit_research_answer', requestId: r.id, ...newAns });
                modal.close();
                openResearchDetailModal(r.id);
                render();
                notify('리서치 답변이 등록되었습니다!');
            });
        }
    }

    function openNewResearchRequestModal() {
        if (!state.user) {
            openKakaoLoginModal(() => openNewResearchRequestModal());
            return;
        }
        const maxReward = Math.min(5, Math.max(1, Number(state.user.passes) || 1));
        const modal = openModal('🎯 종목·차트 리서치 분석 의뢰 올리기', `
            <form id="al-new-req-form" style="display:flex; flex-direction:column; gap:12px;">
                <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:10px;">
                    <div>
                        <label style="display:block; font-size:12px; font-weight:700; color:#94a3b8; margin-bottom:4px;">의뢰 종목코드/티커</label>
                        <input type="text" id="al-rq-ticker" class="al-search-input" style="width:100%;" required placeholder="예: 035420 또는 TSLA">
                    </div>
                    <div>
                        <label style="display:block; font-size:12px; font-weight:700; color:#94a3b8; margin-bottom:4px;">종목명</label>
                        <input type="text" id="al-rq-name" class="al-search-input" style="width:100%;" required placeholder="예: NAVER 또는 테슬라">
                    </div>
                    <div>
                        <label style="display:block; font-size:12px; font-weight:700; color:#94a3b8; margin-bottom:4px;">리워드 현상금 (보유 ${state.user.passes} 패스)</label>
                        <select id="al-rq-reward" class="al-search-input" style="width:100%;">
                            ${Array.from({ length: maxReward }, (_, i) => `<option value="${i + 1}">🎯 ${i + 1} 인사이트 패스</option>`).join('')}
                        </select>
                    </div>
                </div>
                <div>
                    <label style="display:block; font-size:12px; font-weight:700; color:#94a3b8; margin-bottom:4px;">의뢰 제목</label>
                    <input type="text" id="al-rq-title" class="al-search-input" style="width:100%;" required placeholder="예: 삼성전자 주봉 엘리엇 파동 카운팅 및 1차 지지 매수 타점 작도 의뢰합니다">
                </div>
                <div>
                    <label style="display:block; font-size:12px; font-weight:700; color:#94a3b8; margin-bottom:4px;">상세 요청 내용 (궁금한 타임프레임, 매수가격대 등)</label>
                    <textarea id="al-rq-body" class="al-search-input" style="width:100%; min-height:110px;" required placeholder="원하시는 분석 방향(ICT 오더블록, 피보나치 목표가, 동종업계 비교 등)을 구체적으로 적어주세요."></textarea>
                </div>
                <div style="display:flex; justify-content:flex-end; gap:10px;">
                    <button type="button" class="al-ghost-btn" data-al-close>취소</button>
                    <button type="submit" class="al-primary-btn">의뢰 등록하기</button>
                </div>
            </form>
        `);

        modal.querySelector('#al-new-req-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const reward = parseInt(modal.querySelector('#al-rq-reward').value, 10) || 1;
            const ticker = modal.querySelector('#al-rq-ticker').value.trim().toUpperCase();
            const stockName = modal.querySelector('#al-rq-name').value.trim();
            const title = modal.querySelector('#al-rq-title').value.trim();
            const body = modal.querySelector('#al-rq-body').value.trim();

            state.user.passes = Math.max(0, (Number(state.user.passes) || 0) - reward);
            saveCurrentUser(state.user);

            const newRq = {
                id: 'req-' + Date.now(),
                status: 'open',
                ticker,
                stockName,
                title,
                body,
                tags: [stockName, ticker, '리서치의뢰'],
                rewardPass: reward,
                authorId: state.user.id,
                authorNick: state.user.nickname,
                authorTier: state.user.tier || 1,
                created_at: new Date().toISOString().slice(0, 16).replace('T', ' '),
                acceptedAnswerId: null,
                answers: []
            };
            state.db.researchRequests.unshift(newRq);
            saveLocalCommunityDb();
            postCommunityApi({ action: 'create_request', ...newRq });
            modal.close();
            render();
            notify('리서치 의뢰가 등록되었습니다!');
        });
    }

    // =========================================================================
    // 7. [모듈 4] 고객센터 & 파트너십 데스크 (비밀글 🔒 지원 & 운영자 공식 답변)
    // =========================================================================
    function renderSupportTab() {
        const tickets = (state.db && state.db.supportTickets) ? state.db.supportTickets : [];
        const filtered = tickets.filter(t => {
            if (state.supportFilter === 'mine') return state.user && t.authorId === state.user.id;
            if (state.supportFilter !== 'ALL' && t.category !== state.supportFilter) return false;
            return true;
        });

        return `
            <div class="al-toolbar">
                <div class="al-pill-group">
                    <button type="button" class="al-pill-btn ${state.supportFilter === 'ALL' ? 'active' : ''}" data-sup-filter="ALL">전체 문의</button>
                    <button type="button" class="al-pill-btn ${state.supportFilter === 'feature' ? 'active' : ''}" data-sup-filter="feature">💡 기능·테마 추가 제안</button>
                    <button type="button" class="al-pill-btn ${state.supportFilter === 'bug' ? 'active' : ''}" data-sup-filter="bug">🛠️ 데이터·오류 제보</button>
                    <button type="button" class="al-pill-btn ${state.supportFilter === 'partner' ? 'active' : ''}" data-sup-filter="partner">🤝 파트너십·광고 제휴</button>
                    <button type="button" class="al-pill-btn ${state.supportFilter === 'mine' ? 'active' : ''}" data-sup-filter="mine">📋 내 문의 내역</button>
                </div>
                <button type="button" class="al-primary-btn" id="al-btn-new-ticket">
                    <i class="ph-bold ph-lock-key"></i> + 문의 · 제안 등록하기 (비밀글 지원)
                </button>
            </div>

            <div class="qh-table-card">
                <table class="al-feed-table">
                    <thead>
                        <tr>
                            <th style="width:110px;">상태</th>
                            <th style="width:160px;">분류</th>
                            <th>제목</th>
                            <th style="width:150px;">작성자</th>
                            <th style="width:130px; text-align:right;">등록일시</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filtered.length > 0 ? filtered.map(t => `
                            <tr data-open-ticket="${esc(t.id)}">
                                <td>
                                    <span style="padding:2px 8px; border-radius:5px; font-size:11px; font-weight:800; background:${t.status === 'answered' ? 'rgba(16,185,129,0.18)' : 'rgba(148,163,184,0.15)'}; color:${t.status === 'answered' ? '#34d399' : '#94a3b8'};">
                                        ${t.status === 'answered' ? '✓ 답변완료' : '검토 중'}
                                    </span>
                                </td>
                                <td style="font-size:12px; color:#93c5fd; font-weight:700;">${esc(SUPPORT_CATEGORIES[t.category] || '기타 문의')}</td>
                                <td>
                                    ${t.isSecret ? '<i class="ph-fill ph-lock-key" style="color:#fbbf24; margin-right:5px;"></i>' : ''}
                                    <strong style="color:#f8fafc;">${esc(t.title)}</strong>
                                </td>
                                <td style="font-size:12.5px; color:#cbd5e1;">${renderTierEmblem(t.authorTier || 1, 15)} ${esc(t.authorNick)}</td>
                                <td style="text-align:right; font-family:monospace; font-size:12px; color:#94a3b8;">${esc(t.created_at)}</td>
                            </tr>
                        `).join('') : '<tr><td colspan="5" style="padding:40px; text-align:center; color:#64748b;">등록된 문의나 제안 내역이 없습니다.</td></tr>'}
                    </tbody>
                </table>
            </div>
        `;
    }

    function openSupportTicketModal(tktId) {
        const t = (state.db.supportTickets || []).find(x => x.id === tktId);
        if (!t) return;
        const isAdmin = sessionStorage.getItem('dajavata_admin') === '1';
        const isMine = state.user && state.user.id === t.authorId;

        if (t.isSecret && !isAdmin && !isMine) {
            notify('🔒 비밀 문의글은 작성자와 다자바타 운영 데스크만 열람할 수 있습니다.');
            return;
        }

        const modal = openModal(`${t.isSecret ? '🔒 ' : ''}${t.title}`, `
            <div style="display:flex; justify-content:space-between; font-size:12.5px; color:#94a3b8; padding-bottom:10px; border-bottom:1px solid rgba(148,163,184,0.14);">
                <span>분류: <strong style="color:#93c5fd;">${esc(SUPPORT_CATEGORIES[t.category] || '문의')}</strong> · 작성자: <strong style="color:#fff;">${esc(t.authorNick)}</strong></span>
                <span style="font-family:monospace;">${esc(t.created_at)}</span>
            </div>
            <div style="font-size:14px; color:#e2e8f0; line-height:1.75; white-space:pre-wrap; padding:10px 0;">${esc(t.body)}</div>

            ${t.staffReply ? `
                <div style="background:rgba(245,158,11,0.08); border:1px solid rgba(245,158,11,0.35); border-left:4px solid #fbbf24; border-radius:10px; padding:14px 16px;">
                    <div style="display:flex; align-items:center; gap:6px; font-size:12.5px; font-weight:800; color:#fbbf24; margin-bottom:6px;">
                        ${renderTierEmblem(9, 18)} <span>DAJAVATA 공식 운영 데스크 답변 · ${esc(t.staffReplyAt || '')}</span>
                    </div>
                    <div style="font-size:13.5px; color:#f8fafc; line-height:1.65; white-space:pre-wrap;">${esc(t.staffReply)}</div>
                </div>
            ` : '<div style="font-size:12.5px; color:#94a3b8; padding:10px; background:rgba(255,255,255,0.03); border-radius:8px;">운영 데스크에서 내용을 확인 중입니다.</div>'}

            ${isAdmin ? `
                <form id="al-admin-reply-form" style="border-top:1px solid rgba(148,163,184,0.18); padding-top:12px; display:flex; flex-direction:column; gap:8px;">
                    <strong style="font-size:13px; color:#34d399;">🛡️ [관리자 전용] 공식 답변 작성 / 수정</strong>
                    <textarea id="al-admin-reply-text" class="al-search-input" style="width:100%; min-height:80px;" required placeholder="공식 답변 내용을 입력하세요...">${esc(t.staffReply || '')}</textarea>
                    <div style="display:flex; justify-content:flex-end;">
                        <button type="submit" class="al-primary-btn">공식 답변 저장</button>
                    </div>
                </form>
            ` : ''}
        `);

        const admForm = modal.querySelector('#al-admin-reply-form');
        if (admForm) {
            admForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const rep = modal.querySelector('#al-admin-reply-text').value.trim();
                t.staffReply = rep;
                t.staffReplyAt = new Date().toISOString().slice(0, 16).replace('T', ' ');
                t.status = 'answered';
                saveLocalCommunityDb();
                postCommunityApi({
                    action: 'admin_reply_ticket',
                    ticketId: t.id,
                    reply: rep,
                    token: sessionStorage.getItem('dajavata_admin_token') || '',
                    pin: sessionStorage.getItem('dajavata_admin_key') || ''
                });
                modal.close();
                openSupportTicketModal(t.id);
                render();
                notify('공식 답변이 등록되었습니다.');
            });
        }
    }

    function openNewSupportTicketModal() {
        const modal = openModal('🔒 고객센터 문의 & 파트너십 제안 등록', `
            <form id="al-new-tkt-form" style="display:flex; flex-direction:column; gap:12px;">
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
                    <div>
                        <label style="display:block; font-size:12px; font-weight:700; color:#94a3b8; margin-bottom:4px;">문의 분류</label>
                        <select id="al-tk-cat" class="al-search-input" style="width:100%;">
                            <option value="feature">💡 기능·테마 추가 제안</option>
                            <option value="bug">🛠️ 데이터·오류 제보</option>
                            <option value="partner">🤝 파트너십·광고 제휴</option>
                            <option value="etc">기타 이용 문의</option>
                        </select>
                    </div>
                    <div>
                        <label style="display:block; font-size:12px; font-weight:700; color:#94a3b8; margin-bottom:4px;">답변 받을 연락처 (선택 — 이메일/카톡ID)</label>
                        <input type="text" id="al-tk-contact" class="al-search-input" style="width:100%;" placeholder="작성자와 운영 데스크만 열람 가능">
                    </div>
                </div>
                <div>
                    <label style="display:block; font-size:12px; font-weight:700; color:#94a3b8; margin-bottom:4px;">제목 (필수)</label>
                    <input type="text" id="al-tk-title" class="al-search-input" style="width:100%;" required placeholder="문의 또는 제안 제목을 입력해 주세요">
                </div>
                <div>
                    <label style="display:block; font-size:12px; font-weight:700; color:#94a3b8; margin-bottom:4px;">상세 내용</label>
                    <textarea id="al-tk-body" class="al-search-input" style="width:100%; min-height:130px;" required placeholder="추가되었으면 하는 신규 테마나 기능, 제휴 제안 내용을 적어주세요."></textarea>
                </div>
                <label style="display:inline-flex; align-items:center; gap:8px; font-size:13px; font-weight:700; color:#fbbf24; cursor:pointer;">
                    <input type="checkbox" id="al-tk-secret" checked style="width:16px; height:16px; accent-color:#f59e0b;">
                    <span>🔒 비밀글로 등록 (나와 다자바타 운영 데스크만 볼 수 있습니다)</span>
                </label>
                <div style="display:flex; justify-content:flex-end; gap:10px;">
                    <button type="button" class="al-ghost-btn" data-al-close>취소</button>
                    <button type="submit" class="al-primary-btn">문의 등록하기</button>
                </div>
            </form>
        `);

        modal.querySelector('#al-new-tkt-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const cat = modal.querySelector('#al-tk-cat').value;
            const contact = modal.querySelector('#al-tk-contact').value.trim();
            const title = modal.querySelector('#al-tk-title').value.trim();
            const body = modal.querySelector('#al-tk-body').value.trim();
            const isSecret = modal.querySelector('#al-tk-secret').checked;

            const newTkt = {
                id: 'tkt-' + Date.now(),
                category: cat,
                contact,
                title,
                body,
                isSecret,
                authorId: state.user ? state.user.id : 'guest',
                authorNick: state.user ? state.user.nickname : '방문투자자',
                authorTier: state.user ? (state.user.tier || 1) : 1,
                status: 'open',
                created_at: new Date().toISOString().slice(0, 16).replace('T', ' '),
                staffReply: null,
                staffReplyAt: null
            };
            state.db.supportTickets.unshift(newTkt);
            saveLocalCommunityDb();
            postCommunityApi({ action: 'create_ticket', ...newTkt });
            modal.close();
            render();
            notify('문의가 접수되었습니다.');
        });
    }

    // =========================================================================
    // 8. 메인 컨테이너 렌더링 및 이벤트 바인딩
    // =========================================================================
    async function render() {
        const container = document.getElementById('community-hub-container');
        if (!container) return;

        if (!state.db) {
            await ensureCommunityDataLoaded();
        }

        const u = state.user;
        const isAdmin = sessionStorage.getItem('dajavata_admin') === '1';
        const totalMembers = Object.keys(state.db.profiles || {}).length;

        let tabContent = '';
        if (state.currentTab === 'community-vault') tabContent = renderVaultTab();
        else if (state.currentTab === 'community-lounge') tabContent = renderLoungeTab();
        else if (state.currentTab === 'community-research') tabContent = renderResearchTab();
        else if (state.currentTab === 'community-support') tabContent = renderSupportTab();
        else tabContent = renderVaultTab();

        container.innerHTML = `
            <div class="al-top-banner">
                <div class="al-title-area">
                    <span class="al-eyebrow"><i class="ph-fill ph-sparkle"></i> DAJAVATA COLLECTIVE ALPHA NETWORK</span>
                    <h1>다자바타 알파 라운지 & 집단지성 허브</h1>
                    <p>AI 차트 스캐너 작도와 트레이더 룸 매매 시나리오를 원클릭으로 공유·적용하고, 알파 포인트(AP)와 인사이트 패스를 적립하세요.</p>
                    <div style="margin-top:6px; display:inline-flex; align-items:center; gap:6px; background:rgba(16,185,129,0.12); border:1px solid rgba(16,185,129,0.45); color:#34d399; padding:5px 11px; border-radius:7px; font-size:12px; font-weight:700;">
                        <i class="ph-fill ph-shield-check"></i>
                        <span>🔒 다자바타는 실명·이메일·전화번호·비밀번호 등 어떠한 개인정보도 수집하거나 서버에 저장하지 않습니다 (익명 닉네임 기반)</span>
                    </div>
                </div>

                <div class="al-wallet-box">
                    ${u ? `
                        <div class="al-user-chip">
                            ${renderTierEmblem(u.tier || 1, 22)}
                            <span>${esc(u.nickname)}</span>
                            ${renderTierBadge(u.tier || 1)}
                        </div>
                        <span class="al-stat-pill">⚡ 기여 ${Number(u.ap) || 0} AP</span>
                        <span class="al-stat-pill pass">🎯 보유 ${Number(u.passes) || 0} 패스</span>
                        <button type="button" class="al-ghost-btn" id="al-btn-cloud-sync">☁️ 트레이더 룸 동기화</button>
                        <button type="button" class="al-ghost-btn" id="al-btn-profile-edit">계정</button>
                    ` : `
                        <span style="font-size:12.5px; color:#cbd5e1;">로그인하면 매일 <b>무료 패스 3개</b>와 클라우드 동기화가 제공됩니다.</span>
                        <button type="button" class="al-kakao-btn" id="al-btn-kakao-login">
                            <i class="ph-fill ph-chat-circle-dots"></i> 카카오 1초 로그인
                        </button>
                    `}
                    <button type="button" class="al-ghost-btn" id="al-btn-tier-guide">🏆 등급·패스 안내</button>
                    ${isAdmin ? `
                        <button type="button" class="al-ghost-btn" id="al-btn-admin-analytics" style="border-color:#10b981; color:#34d399; background:rgba(16,185,129,0.15);">
                            📊 방문자·유입 통계 (Admin)
                        </button>
                    ` : ''}
                </div>
            </div>

            <div class="al-nav-tabs">
                <div class="al-nav-left">
                    <button type="button" class="al-tab-btn ${state.currentTab === 'community-vault' ? 'active' : ''}" data-al-tab="community-vault">
                        📈 알파 차트·시나리오 볼트 (${(state.db.vaultItems || []).length})
                    </button>
                    <button type="button" class="al-tab-btn ${state.currentTab === 'community-lounge' ? 'active' : ''}" data-al-tab="community-lounge">
                        💬 마켓 라운지 · 종목토론 (${(state.db.loungePosts || []).length})
                    </button>
                    <button type="button" class="al-tab-btn ${state.currentTab === 'community-research' ? 'active' : ''}" data-al-tab="community-research">
                        🎯 종목·차트 리서치 의뢰소 (${(state.db.researchRequests || []).length})
                    </button>
                    <button type="button" class="al-tab-btn ${state.currentTab === 'community-support' ? 'active' : ''}" data-al-tab="community-support">
                        🔒 고객센터 & 파트너십 (${(state.db.supportTickets || []).length})
                    </button>
                </div>
                <span style="font-size:12px; color:#94a3b8;">활동 트레이더 <strong style="color:#38bdf8;">${totalMembers}명</strong> 참여 중</span>
            </div>

            ${tabContent}
        `;

        bindLoungeEvents(container);
        syncHeaderAuthWidget();
    }

    function bindLoungeEvents(container) {
        const kLogin = container.querySelector('#al-btn-kakao-login');
        if (kLogin) kLogin.addEventListener('click', () => openKakaoLoginModal());
        const pEdit = container.querySelector('#al-btn-profile-edit');
        if (pEdit) pEdit.addEventListener('click', () => openKakaoLoginModal());
        const cSync = container.querySelector('#al-btn-cloud-sync');
        if (cSync) cSync.addEventListener('click', () => openCloudSyncModal());
        const tGuide = container.querySelector('#al-btn-tier-guide');
        if (tGuide) tGuide.addEventListener('click', () => openTierGuideModal());
        const admAn = container.querySelector('#al-btn-admin-analytics');
        if (admAn) admAn.addEventListener('click', () => openAdminAnalyticsModal());

        container.querySelectorAll('[data-al-tab]').forEach(btn => {
            btn.addEventListener('click', () => {
                window.CommunityHub.navigate(btn.getAttribute('data-al-tab'));
            });
        });

        // Vault events
        container.querySelectorAll('[data-vault-kind]').forEach(btn => {
            btn.addEventListener('click', () => {
                state.vaultKind = btn.getAttribute('data-vault-kind');
                render();
            });
        });
        container.querySelectorAll('[data-vault-mkt]').forEach(btn => {
            btn.addEventListener('click', () => {
                state.vaultMarket = btn.getAttribute('data-vault-mkt');
                render();
            });
        });
        const vSort = container.querySelector('#al-vault-sort');
        if (vSort) {
            vSort.addEventListener('change', (e) => {
                state.vaultSort = e.target.value;
                render();
            });
        }
        const vSearch = container.querySelector('#al-vault-search');
        if (vSearch) {
            vSearch.addEventListener('input', (e) => {
                state.vaultSearch = e.target.value;
                render();
                const el = container.querySelector('#al-vault-search');
                if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
            });
        }
        const shareBtn = container.querySelector('#al-btn-open-share-vault');
        if (shareBtn) shareBtn.addEventListener('click', () => openShareVaultModal());

        container.querySelectorAll('[data-vault-import]').forEach(btn => {
            btn.addEventListener('click', () => handleImportVaultToScanner(btn.getAttribute('data-vault-import'), false));
        });
        container.querySelectorAll('[data-vault-to-trader]').forEach(btn => {
            btn.addEventListener('click', () => handleImportVaultToScanner(btn.getAttribute('data-vault-to-trader'), true));
        });
        container.querySelectorAll('[data-vault-like]').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.getAttribute('data-vault-like');
                const it = (state.db.vaultItems || []).find(x => x.id === id);
                if (it) {
                    it.likes = (Number(it.likes) || 0) + 1;
                    saveLocalCommunityDb();
                    postCommunityApi({ action: 'like_item', targetType: 'vault', targetId: id });
                    render();
                }
            });
        });

        // Lounge events
        container.querySelectorAll('[data-lounge-ch]').forEach(btn => {
            btn.addEventListener('click', () => {
                state.loungeChannel = btn.getAttribute('data-lounge-ch');
                render();
            });
        });
        const lSearch = container.querySelector('#al-lounge-search');
        if (lSearch) {
            lSearch.addEventListener('input', (e) => {
                state.loungeSearch = e.target.value;
                render();
                const el = container.querySelector('#al-lounge-search');
                if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
            });
        }
        const npBtn = container.querySelector('#al-btn-new-post');
        if (npBtn) npBtn.addEventListener('click', () => openNewLoungePostModal());

        container.querySelectorAll('[data-quick-ticker]').forEach(el => {
            el.addEventListener('click', (e) => {
                e.stopPropagation();
                const code = el.getAttribute('data-quick-ticker');
                const nm = el.getAttribute('data-quick-name');
                container.style.display = 'none';
                window.openInDajavataScanner(code, nm);
            });
        });
        container.querySelectorAll('[data-open-post]').forEach(row => {
            row.addEventListener('click', () => openLoungePostModal(row.getAttribute('data-open-post')));
        });

        // Research events
        container.querySelectorAll('[data-req-filter]').forEach(btn => {
            btn.addEventListener('click', () => {
                state.researchFilter = btn.getAttribute('data-req-filter');
                render();
            });
        });
        const nrBtn = container.querySelector('#al-btn-new-request');
        if (nrBtn) nrBtn.addEventListener('click', () => openNewResearchRequestModal());
        container.querySelectorAll('[data-open-req]').forEach(card => {
            card.addEventListener('click', () => openResearchDetailModal(card.getAttribute('data-open-req')));
        });

        // Support events
        container.querySelectorAll('[data-sup-filter]').forEach(btn => {
            btn.addEventListener('click', () => {
                state.supportFilter = btn.getAttribute('data-sup-filter');
                render();
            });
        });
        const ntBtn = container.querySelector('#al-btn-new-ticket');
        if (ntBtn) ntBtn.addEventListener('click', () => openNewSupportTicketModal());
        container.querySelectorAll('[data-open-ticket]').forEach(row => {
            row.addEventListener('click', () => openSupportTicketModal(row.getAttribute('data-open-ticket')));
        });
    }

    // 외부 공개 API
    window.CommunityHub = {
        navigate(tabAction) {
            state.currentTab = tabAction || 'community-vault';

            const defaultView = document.getElementById('default-view-container');
            const traderWorkspace = document.getElementById('trader-workspace-container');
            const scannerContainer = document.getElementById('chart-scanner-container');
            const quantHubContainer = document.getElementById('quant-hub-container');
            const communityContainer = document.getElementById('community-hub-container');

            if (!communityContainer) return;

            if (defaultView) defaultView.style.display = 'none';
            if (traderWorkspace) traderWorkspace.style.display = 'none';
            if (scannerContainer) scannerContainer.style.display = 'none';
            if (quantHubContainer) quantHubContainer.style.display = 'none';
            communityContainer.style.display = 'flex';

            document.querySelectorAll('.menu-section li').forEach(li => li.classList.remove('active'));
            const activeLi = document.querySelector(`.menu-section li[data-action="${state.currentTab}"]`);
            if (activeLi) activeLi.classList.add('active');

            trackVisitorActivity('알파 라운지 (' + state.currentTab.replace('community-', '') + ')');
            render();
        },

        hide() {
            const communityContainer = document.getElementById('community-hub-container');
            if (communityContainer) communityContainer.style.display = 'none';
        },

        openKakaoLoginModal,
        openTierGuideModal,
        openCloudSyncModal,
        openAdminAnalyticsModal,
        openShareVaultModal,
        syncHeaderAuthWidget,
        trackVisitorActivity
    };

    // =========================================================================
    // 9. [🏠 다자바타 메인 홈] — 심플 2단 구성 (① 주요 증시 상황판 미니차트 + ② 당일 실시간 시총 히트맵)
    //    * "불러오는 중..." 제로(0%): 접속 0.01초 즉시 100% 렌더링 후 실시간 시세 자동 오버레이
    // =========================================================================
    const homeState = {
        indexRegion: 'GLOBAL', // 'GLOBAL' (한·미·글로벌 핵심) | 'EUROPE' (유럽·아시아 상세 - 참고 이미지 2 동일 구성)
        heatmapTab: 'KR',      // 'KR' (국장 시총·업종 히트맵) | 'US' (미장 빅테크·섹터 히트맵) | 'THEME' (당일 주도 테마 히트맵)
        liveSyncStarted: false,
        quantCache: null
    };

    // [1단 데이터] 한·미·글로벌 핵심 지수 & 유럽 증시 상황판 (실시간 API 응답 시 즉시 덮어씀)
    const INDEX_GROUPS = {
        GLOBAL: {
            featured: [
                {
                    id: 'KOSPI', flag: '🇰🇷', name: '코스피 (KOSPI)', status: '실시간',
                    price: 2545.82, chg: 38.45, chgPct: 1.53,
                    high52: '2,896.43', low52: '2,386.96',
                    prev: '2,507.37', high: '2,552.18', low: '2,514.20',
                    ticks: ['09:00', '11:30', '14:00', '15:30'],
                    series: [2514, 2521, 2519, 2528, 2534, 2531, 2539, 2544, 2541, 2547, 2545.82]
                },
                {
                    id: 'KOSDAQ', flag: '🇰🇷', name: '코스닥 (KOSDAQ)', status: '실시간',
                    price: 728.64, chg: 12.18, chgPct: 1.70,
                    high52: '901.89', low52: '672.45',
                    prev: '716.46', high: '731.10', low: '718.05',
                    ticks: ['09:00', '11:30', '14:00', '15:30'],
                    series: [718, 720, 719, 722, 725, 724, 727, 726, 729, 730, 728.64]
                },
                {
                    id: 'NASDAQ', flag: '🇺🇸', name: '나스닥 종합 (NASDAQ)', status: '장마감',
                    price: 19174.30, chg: 195.66, chgPct: 1.03,
                    high52: '19,366.07', low52: '14,477.57',
                    prev: '18,978.64', high: '19,215.40', low: '19,012.10',
                    ticks: ['23:30', '01:30', '03:30', '06:00'],
                    series: [19015, 19045, 19080, 19065, 19110, 19140, 19125, 19160, 19185, 19174.30]
                },
                {
                    id: 'SP500', flag: '🇺🇸', name: 'S&P 500', status: '장마감',
                    price: 6021.63, chg: 39.20, chgPct: 0.66,
                    high52: '6,044.17', low52: '4,682.11',
                    prev: '5,982.43', high: '6,032.80', low: '5,990.15',
                    ticks: ['23:30', '01:30', '03:30', '06:00'],
                    series: [5992, 5998, 6005, 6001, 6012, 6018, 6015, 6024, 6020, 6021.63]
                }
            ],
            bottomLeft: {
                id: 'SOX', flag: '🇺🇸', name: '필라델피아 반도체', status: '장마감',
                price: 5118.42, chg: 98.74, chgPct: 1.97,
                high52: '5,931.83', low52: '4,180.50',
                prev: '5,019.68', high: '5,142.10', low: '5,035.20',
                ticks: ['23:30', '02:00', '05:00'],
                series: [5035, 5052, 5048, 5075, 5092, 5088, 5105, 5124, 5118.42]
            },
            pairs: [
                [
                    { flag: '🇺🇸', name: '다우존스 산업', price: '44,860.31', chgText: '▲ 188.59(+0.42%)', up: true, sub: '52주 최고 45,073.63' },
                    { flag: '🇯🇵', name: '일본 닛케이 225', price: '38,780.14', chgText: '▲ 342.18(+0.89%)', up: true, sub: '52주 최고 42,426.77' },
                    { flag: '🇺🇸', name: '러셀 2000', price: '2,442.06', chgText: '▲ 18.40(+0.76%)', up: true, sub: '52주 최고 2,466.49' },
                    { flag: '🇹🇼', name: '대만 가권', price: '22,948.35', chgText: '▲ 214.60(+0.94%)', up: true, sub: '52주 최고 24,416.67' }
                ],
                [
                    { flag: '🇪🇺', name: '유로스톡스 50', price: '6,014.74', chgText: '▲ 120.28(+2.04%)', up: true, sub: '52주 최고 6,577.20' },
                    { flag: '🇩🇪', name: '독일 DAX', price: '25,215.52', chgText: '▲ 513.39(+2.08%)', up: true, sub: '52주 최고 27,001.67' },
                    { flag: '🇬🇧', name: '영국 FTSE 100', price: '10,609.30', chgText: '▲ 182.36(+1.75%)', up: true, sub: '52주 최고 10,989.45' },
                    { flag: '🇫🇷', name: '프랑스 CAC 40', price: '8,108.74', chgText: '▲ 128.17(+1.61%)', up: true, sub: '52주 최고 8,755.03' }
                ],
                [
                    { flag: '💵', name: '원/달러 환율', price: '1,394.50', chgText: '▼ 4.20(-0.30%)', up: false, sub: '52주 최고 1,411.20' },
                    { flag: '🏦', name: '미 국채 10년물', price: '4.24%', chgText: '▼ 0.04(-0.93%)', up: false, sub: '한·미 기준금리 2.75/3.88%' },
                    { flag: '🪙', name: '국제 금 (Gold)', price: '$2,658.40', chgText: '▲ 24.10(+0.92%)', up: true, sub: '52주 최고 $2,801.80' },
                    { flag: '🛢️', name: 'WTI 원유 선물', price: '$68.92', chgText: '▼ 0.48(-0.69%)', up: false, sub: '52주 최고 $87.67' }
                ]
            ]
        },
        EUROPE: {
            featured: [
                {
                    id: 'STOXX50', flag: '🇪🇺', name: '유로스톡스 50', status: '장마감',
                    price: 6014.74, chg: 120.28, chgPct: 2.04,
                    high52: '6,577.20', low52: '5,378.81',
                    prev: '5,894.46', high: '6,037.22', low: '5,920.89',
                    ticks: ['10:45', '13:30', '16:15'],
                    series: [5921, 5948, 5962, 5955, 5978, 5990, 5984, 6002, 6018, 6014.74]
                },
                {
                    id: 'STOXX50F', flag: '🇪🇺', name: '유로스톡스 50 선물', status: '장마감',
                    price: 6026.00, chg: 114.00, chgPct: 1.93,
                    high52: '6,026.00', low52: '0.00',
                    prev: '5,912.00', high: '6,055.00', low: '6,004.00',
                    ticks: ['06:30', '11:45', '17:45'],
                    series: [6005, 6018, 6012, 6024, 6019, 6035, 6028, 6022, 6029, 6026.00]
                },
                {
                    id: 'DAX', flag: '🇩🇪', name: '독일 DAX', status: '장마감',
                    price: 25215.52, chg: 513.39, chgPct: 2.08,
                    high52: '27,001.67', low52: '21,863.81',
                    prev: '24,702.13', high: '25,300.88', low: '25,114.25',
                    ticks: ['10:45', '13:15', '15:45'],
                    series: [25115, 25160, 25148, 25195, 25210, 25188, 25230, 25245, 25215.52]
                },
                {
                    id: 'DAXF', flag: '🇩🇪', name: '독일 DAX 선물', status: '장마감',
                    price: 25288.00, chg: 508.00, chgPct: 2.05,
                    high52: '25,288.00', low52: '0.00',
                    prev: '24,780.00', high: '25,345.00', low: '25,154.00',
                    ticks: ['06:30', '11:45', '17:45'],
                    series: [25158, 25210, 25195, 25245, 25230, 25270, 25260, 25295, 25288.00]
                }
            ],
            bottomLeft: {
                id: 'FTSE100', flag: '🇬🇧', name: '영국 FTSE 100', status: '장마감',
                price: 10609.30, chg: 182.36, chgPct: 1.75,
                high52: '10,989.45', low52: '9,593.26',
                prev: '10,426.94', high: '10,636.49', low: '10,425.37',
                ticks: ['09:45', '12:15', '14:45'],
                series: [10428, 10465, 10490, 10510, 10505, 10545, 10580, 10615, 10609.30]
            },
            pairs: [
                [
                    { flag: '🇫🇷', name: '프랑스 CAC 40', price: '8,108.74', chgText: '▲ 128.17(+1.61%)', up: true, sub: '52주 최고 8,755.03' },
                    { flag: '🇮🇹', name: '이탈리아 FTSE MIB', price: '48,362.35', chgText: '▲ 1,113.20(+2.36%)', up: true, sub: '52주 최고 54,041.80' },
                    { flag: '🇳🇱', name: '네덜란드 AEX', price: '1,083.26', chgText: '▲ 19.82(+1.86%)', up: true, sub: '52주 최고 1,147.35' },
                    { flag: '🇧🇪', name: '벨기에 BEL 20', price: '5,929.44', chgText: '▲ 91.73(+1.57%)', up: true, sub: '52주 최고 6,144.44' }
                ],
                [
                    { flag: '🇪🇸', name: '스페인 IBEX 35', price: '19,057.90', chgText: '▲ 422.10(+2.26%)', up: true, sub: '52주 최고 20,356.50' },
                    { flag: '🇵🇹', name: '포르투갈 PSI 20', price: '9,377.04', chgText: '▲ 122.96(+1.33%)', up: true, sub: '52주 최고 9,759.12' },
                    { flag: '🇮🇪', name: '아일랜드 ISEQ', price: '14,384.11', chgText: '▲ 263.48(+1.87%)', up: true, sub: '52주 최고 15,144.35' },
                    { flag: '🇩🇰', name: '덴마크 OMXC', price: '1,634.75', chgText: '▲ 21.43(+1.33%)', up: true, sub: '52주 최고 1,800.63' }
                ],
                [
                    { flag: '🇸🇪', name: '스웨덴 OMXS', price: '3,251.38', chgText: '▲ 63.27(+1.98%)', up: true, sub: '52주 최고 3,373.51' },
                    { flag: '🇫🇮', name: '핀란드 OMXH', price: '5,994.73', chgText: '▲ 128.17(+2.18%)', up: true, sub: '52주 최고 6,663.48' },
                    { flag: '🇬🇷', name: '그리스 ATG', price: '2,479.94', chgText: '▲ 25.00(+1.02%)', up: true, sub: '52주 최고 2,745.54' },
                    { flag: '🇭🇺', name: '헝가리 BUX', price: '135,959.54', chgText: '▲ 725.58(+0.54%)', up: true, sub: '52주 최고 155,001.10' }
                ]
            ]
        }
    };

    // [2단 데이터] 참고 이미지 1과 100% 동일한 국장 업종별 시가총액 히트맵 구조 (실시간 시세 자동 동기화)
    const KR_SECTOR_TREE = [
        {
            sector: '전기·전자',
            weight: 380,
            stocks: [
                { code: '005930', name: '삼성전자', weight: 195, chg: 4.09, price: 58400 },
                { code: '000660', name: 'SK하이닉스', weight: 125, chg: 4.46, price: 189500 },
                { code: '373220', name: 'LG에너지솔루션', weight: 28, chg: 3.48, price: 412000 },
                { code: '009150', name: '삼성전기', weight: 13, chg: 2.93, price: 137000 },
                { code: '006400', name: '삼성SDI', weight: 11, chg: 7.42, price: 275000 },
                { code: '066570', name: 'LG전자', weight: 10, chg: 5.55, price: 95100 },
                { code: '298040', name: '효성중공업', weight: 6.5, chg: 5.95, price: 428000 },
                { code: '272210', name: '한화시스템', weight: 4.5, chg: 13.19, price: 24850 },
                { code: '003670', name: '포스코퓨처엠', weight: 6.0, chg: 6.00, price: 176500 },
                { code: '267260', name: 'HD현대일렉트릭', weight: 5.5, chg: 6.41, price: 365000 },
                { code: '066970', name: '엘앤에프', weight: 3.5, chg: 4.53, price: 96900 },
                { code: '000150', name: '두산', weight: 3.5, chg: 4.32, price: 217500 },
                { code: '011070', name: 'LG이노텍', weight: 3.5, chg: 2.85, price: 173200 },
                { code: '001820', name: '삼화콘덴서', weight: 2.5, chg: 1.56, price: 35800 }
            ]
        },
        {
            sector: '기타금융',
            weight: 86,
            stocks: [
                { code: '402340', name: 'SK스퀘어', weight: 22, chg: 3.68, price: 87300 },
                { code: '105560', name: 'KB금융', weight: 20, chg: -0.89, price: 94800 },
                { code: '055550', name: '신한지주', weight: 15, chg: -1.77, price: 55400 },
                { code: '034730', name: 'SK', weight: 12, chg: 8.84, price: 152600 },
                { code: '086790', name: '하나금융지주', weight: 11, chg: -1.17, price: 63200 },
                { code: '316140', name: '우리금융지주', weight: 8.5, chg: -1.84, price: 16530 },
                { code: '180640', name: '한진칼', weight: 8.5, chg: 5.59, price: 77400 },
                { code: '267250', name: 'HD현대', weight: 7.5, chg: 4.41, price: 82900 },
                { code: '138040', name: '메리츠금융지주', weight: 7.5, chg: -0.60, price: 103800 },
                { code: '003550', name: 'LG', weight: 8.5, chg: 1.76, price: 75300 },
                { code: '078930', name: 'GS', weight: 5.0, chg: 1.32, price: 42150 }
            ]
        },
        {
            sector: '운송장비·부품',
            weight: 78,
            stocks: [
                { code: '005380', name: '현대차', weight: 26, chg: 2.90, price: 219500 },
                { code: '000270', name: '기아', weight: 21, chg: 1.17, price: 95400 },
                { code: '012450', name: '한화에어로스페이스', weight: 13, chg: 5.10, price: 371000 },
                { code: '329180', name: 'HD현대중공업', weight: 13, chg: 3.77, price: 220000 },
                { code: '012330', name: '현대모비스', weight: 12, chg: 1.82, price: 252000 },
                { code: '042660', name: '한화오션', weight: 8.5, chg: 6.04, price: 37750 },
                { code: '010140', name: '삼성중공업', weight: 7.0, chg: 4.36, price: 11730 },
                { code: '064350', name: '현대로템', weight: 6.0, chg: 3.45, price: 62900 }
            ]
        },
        {
            sector: '제약',
            weight: 54,
            stocks: [
                { code: '207940', name: '삼성바이오로직스', weight: 28, chg: 0.75, price: 945000 },
                { code: '068270', name: '셀트리온', weight: 22, chg: 2.09, price: 181000 },
                { code: '000100', name: '유한양행', weight: 6.5, chg: 3.12, price: 125400 },
                { code: '000250', name: '삼천당제약', weight: 5.0, chg: 2.45, price: 142000 },
                { code: '128940', name: '한미약품', weight: 4.5, chg: 1.85, price: 298000 },
                { code: '028300', name: 'HLB', weight: 4.5, chg: 1.40, price: 72600 }
            ]
        },
        {
            sector: 'IT 서비스',
            weight: 38,
            stocks: [
                { code: '035420', name: 'NAVER', weight: 18, chg: 1.62, price: 194500 },
                { code: '035720', name: '카카오', weight: 11, chg: 2.48, price: 37200 },
                { code: '259960', name: '크래프톤', weight: 9, chg: -0.24, price: 318500 },
                { code: '018260', name: '삼성에스디에스', weight: 7, chg: 0.31, price: 142800 }
            ]
        },
        {
            sector: '보험',
            weight: 32,
            stocks: [
                { code: '032830', name: '삼성생명', weight: 16, chg: 4.58, price: 105100 },
                { code: '000810', name: '삼성화재', weight: 14, chg: 0.97, price: 364500 },
                { code: '005830', name: 'DB손해보험', weight: 6, chg: -1.15, price: 103200 }
            ]
        },
        {
            sector: '화학',
            weight: 36,
            stocks: [
                { code: '051910', name: 'LG화학', weight: 14, chg: 4.56, price: 298000 },
                { code: '096770', name: 'SK이노베이션', weight: 10, chg: 2.85, price: 115400 },
                { code: '247540', name: '에코프로비엠', weight: 9, chg: 5.12, price: 139500 },
                { code: '086520', name: '에코프로', weight: 7, chg: 4.25, price: 68700 },
                { code: '010950', name: 'S-Oil', weight: 6, chg: 0.53, price: 57200 },
                { code: '090430', name: '아모레퍼시픽', weight: 5, chg: -1.24, price: 111500 }
            ]
        },
        {
            sector: '기계·장비',
            weight: 34,
            stocks: [
                { code: '034020', name: '두산에너빌리티', weight: 16, chg: 6.67, price: 21600 },
                { code: '042700', name: '한미반도체', weight: 14, chg: 7.11, price: 94900 },
                { code: '277810', name: '레인보우로보틱스', weight: 6, chg: 5.40, price: 158200 },
                { code: '454910', name: '두산로보틱스', weight: 5, chg: 3.18, price: 68100 }
            ]
        },
        {
            sector: '유통',
            weight: 24,
            stocks: [
                { code: '028260', name: '삼성물산', weight: 18, chg: 4.38, price: 126300 },
                { code: '004170', name: '신세계', weight: 4, chg: 1.12, price: 144500 },
                { code: '139480', name: '이마트', weight: 4, chg: -0.65, price: 61200 }
            ]
        },
        {
            sector: '운송·창고',
            weight: 20,
            stocks: [
                { code: '011200', name: 'HMM', weight: 12, chg: 0.45, price: 17880 },
                { code: '086280', name: '현대글로비스', weight: 8, chg: 0.87, price: 116000 },
                { code: '003490', name: '대한항공', weight: 6, chg: 1.25, price: 24300 }
            ]
        },
        {
            sector: '음식료·담배',
            weight: 18,
            stocks: [
                { code: '033780', name: 'KT&G', weight: 12, chg: -1.73, price: 119300 },
                { code: '003230', name: '삼양식품', weight: 6, chg: -0.92, price: 539000 },
                { code: '271560', name: '오리온', weight: 4, chg: 0.40, price: 100500 }
            ]
        },
        {
            sector: '일반서비스',
            weight: 22,
            stocks: [
                { code: '196170', name: '알테오젠', weight: 15, chg: 7.29, price: 389500 },
                { code: '028050', name: '삼성E&A', weight: 6, chg: 3.82, price: 19020 },
                { code: '021240', name: '코웨이', weight: 4, chg: -2.18, price: 67300 }
            ]
        },
        {
            sector: '금속',
            weight: 18,
            stocks: [
                { code: '005490', name: 'POSCO홀딩스', weight: 12, chg: 2.15, price: 285000 },
                { code: '010130', name: '고려아연', weight: 10, chg: 3.53, price: 1173000 }
            ]
        },
        {
            sector: '증권·은행',
            weight: 18,
            stocks: [
                { code: '024110', name: '기업은행', weight: 9, chg: -0.25, price: 14120 },
                { code: '006800', name: '미래에셋증권', weight: 6, chg: 2.35, price: 8710 },
                { code: '071050', name: '한국금융지주', weight: 5, chg: 1.80, price: 73500 }
            ]
        },
        {
            sector: '통신·전기가스',
            weight: 18,
            stocks: [
                { code: '015760', name: '한국전력', weight: 9, chg: 2.35, price: 21750 },
                { code: '030200', name: 'KT', weight: 7, chg: -2.72, price: 44750 },
                { code: '017670', name: 'SK텔레콤', weight: 6, chg: -0.86, price: 57600 }
            ]
        }
    ];

    // 미장 빅테크·섹터 시가총액 히트맵 구조
    const US_SECTOR_TREE = [
        {
            sector: '반도체 · AI 하드웨어',
            weight: 280,
            stocks: [
                { code: 'NVDA', name: 'NVIDIA', weight: 145, chg: 3.42, price: 138.60 },
                { code: 'AVGO', name: 'Broadcom', weight: 48, chg: 2.85, price: 168.40 },
                { code: 'TSM', name: 'TSMC', weight: 42, chg: 2.14, price: 191.20 },
                { code: 'AMD', name: 'AMD', weight: 22, chg: 1.92, price: 139.50 },
                { code: 'MU', name: 'Micron', weight: 16, chg: 4.15, price: 104.80 },
                { code: 'ASML', name: 'ASML', weight: 18, chg: 1.45, price: 682.10 },
                { code: 'QCOM', name: 'Qualcomm', weight: 14, chg: 0.95, price: 159.30 },
                { code: 'AMAT', name: 'Applied Mat.', weight: 12, chg: 1.60, price: 174.20 }
            ]
        },
        {
            sector: '빅테크 · 소프트웨어',
            weight: 240,
            stocks: [
                { code: 'AAPL', name: 'Apple', weight: 115, chg: 0.84, price: 235.10 },
                { code: 'MSFT', name: 'Microsoft', weight: 108, chg: 1.18, price: 428.50 },
                { code: 'ORCL', name: 'Oracle', weight: 26, chg: 2.40, price: 188.20 },
                { code: 'CRM', name: 'Salesforce', weight: 18, chg: 1.55, price: 332.10 },
                { code: 'PLTR', name: 'Palantir', weight: 18, chg: 6.12, price: 65.80 },
                { code: 'ADBE', name: 'Adobe', weight: 14, chg: -0.75, price: 512.40 }
            ]
        },
        {
            sector: '인터넷 · 플랫폼',
            weight: 165,
            stocks: [
                { code: 'GOOGL', name: 'Alphabet', weight: 78, chg: 1.65, price: 176.80 },
                { code: 'META', name: 'Meta', weight: 62, chg: 2.31, price: 584.20 },
                { code: 'NFLX', name: 'Netflix', weight: 22, chg: 1.94, price: 892.50 },
                { code: 'UBER', name: 'Uber', weight: 14, chg: -1.12, price: 72.40 }
            ]
        },
        {
            sector: '전자상거래 · 전기차',
            weight: 165,
            stocks: [
                { code: 'AMZN', name: 'Amazon', weight: 78, chg: 2.08, price: 208.90 },
                { code: 'TSLA', name: 'Tesla', weight: 48, chg: 4.65, price: 346.20 },
                { code: 'WMT', name: 'Walmart', weight: 26, chg: 1.15, price: 91.40 },
                { code: 'COST', name: 'Costco', weight: 20, chg: 0.72, price: 964.10 },
                { code: 'HD', name: 'Home Depot', weight: 18, chg: -0.45, price: 424.30 }
            ]
        },
        {
            sector: '금융 · 결제',
            weight: 115,
            stocks: [
                { code: 'BRK.B', name: 'Berkshire', weight: 38, chg: 0.54, price: 478.20 },
                { code: 'JPM', name: 'JPMorgan', weight: 30, chg: 1.32, price: 248.60 },
                { code: 'V', name: 'Visa', weight: 24, chg: 0.88, price: 312.40 },
                { code: 'MA', name: 'Mastercard', weight: 20, chg: 0.76, price: 526.80 },
                { code: 'GS', name: 'Goldman Sachs', weight: 14, chg: 1.95, price: 604.10 }
            ]
        },
        {
            sector: '헬스케어 · 제약',
            weight: 95,
            stocks: [
                { code: 'LLY', name: 'Eli Lilly', weight: 36, chg: 2.64, price: 798.50 },
                { code: 'UNH', name: 'UnitedHealth', weight: 26, chg: -0.92, price: 598.20 },
                { code: 'JNJ', name: 'J&J', weight: 18, chg: -0.35, price: 155.40 },
                { code: 'ABBV', name: 'AbbVie', weight: 16, chg: 1.14, price: 181.20 }
            ]
        },
        {
            sector: '에너지 · 산업 · 방산',
            weight: 75,
            stocks: [
                { code: 'XOM', name: 'ExxonMobil', weight: 24, chg: -0.84, price: 118.40 },
                { code: 'GE', name: 'GE Aerospace', weight: 18, chg: 2.45, price: 182.60 },
                { code: 'CAT', name: 'Caterpillar', weight: 16, chg: 1.52, price: 402.10 },
                { code: 'CVX', name: 'Chevron', weight: 15, chg: -0.62, price: 161.80 }
            ]
        }
    ];

    // 한국 증시 표준 히트맵 색상 (상승=선명한 레드, 하락=선명한 블루)
    function getHeatmapColor(chg) {
        const v = Number(chg) || 0;
        if (v >= 3.5) return '#e92928';
        if (v >= 2.0) return '#d82b2b';
        if (v >= 1.0) return '#bd292a';
        if (v >= 0.25) return '#91292d';
        if (v > 0.0) return '#662831';
        if (v === 0) return '#2c3242';
        if (v <= -3.5) return '#1565c0';
        if (v <= -2.0) return '#1859aa';
        if (v <= -1.0) return '#1d4c91';
        if (v <= -0.25) return '#223e73';
        return '#263457';
    }

    // 이진 분할(Binary Slice-and-Dice / Squarified) 트리맵 레이아웃 엔진 (% 좌표 반환)
    function computeTreemapRects(items, x, y, w, h) {
        const valid = (items || []).filter(it => (Number(it.weight) || 0) > 0);
        if (valid.length === 0) return [];
        if (valid.length === 1) {
            return [{ ...valid[0], x, y, w, h }];
        }
        const total = valid.reduce((s, it) => s + Number(it.weight), 0);
        let acc = 0;
        let splitIdx = 0;
        for (let i = 0; i < valid.length - 1; i++) {
            acc += Number(valid[i].weight);
            splitIdx = i + 1;
            if (acc >= total * 0.5) break;
        }
        // 첫 번째 아이템이 절반 이상이면 단독 분할
        const leftSum = valid.slice(0, splitIdx).reduce((s, it) => s + Number(it.weight), 0);
        const ratio = total > 0 ? (leftSum / total) : 0.5;

        // 가로가 더 넓으면 좌/우 분할, 세로가 더 길면 상/하 분할 (정사각형에 가깝게 유지)
        if (w >= h * 1.08) {
            const w1 = w * ratio;
            return [
                ...computeTreemapRects(valid.slice(0, splitIdx), x, y, w1, h),
                ...computeTreemapRects(valid.slice(splitIdx), x + w1, y, w - w1, h)
            ];
        } else {
            const h1 = h * ratio;
            return [
                ...computeTreemapRects(valid.slice(0, splitIdx), x, y, w, h1),
                ...computeTreemapRects(valid.slice(splitIdx), x, y + h1, w, h - h1)
            ];
        }
    }

    // 미니 스파크라인 SVG 생성기 (참고 이미지 2 스타일)
    function buildIndexSparklineSvg(series, isUp) {
        const pts = (Array.isArray(series) && series.length >= 2) ? series : [100, 101, 102];
        const minV = Math.min(...pts);
        const maxV = Math.max(...pts);
        const span = Math.max(0.0001, maxV - minV);
        const W = 200;
        const H = 52;
        const coords = pts.map((v, i) => {
            const px = Math.round((i / (pts.length - 1)) * (W - 4)) + 2;
            const py = Math.round(H - 6 - ((v - minV) / span) * (H - 14));
            return `${px},${py}`;
        });
        const strokeColor = isUp ? '#f43f5e' : '#3b82f6';
        const gradId = 'idxGrad_' + Math.random().toString(36).slice(2, 8);
        const areaPath = `M 2,${H} L ${coords.join(' L ')} L ${W - 2},${H} Z`;
        const linePath = `M ${coords.join(' L ')}`;

        return `
            <svg viewBox="0 0 ${W} ${H}" width="100%" height="52" preserveAspectRatio="none" style="display:block;">
                <defs>
                    <linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stop-color="${strokeColor}" stop-opacity="0.32"/>
                        <stop offset="100%" stop-color="${strokeColor}" stop-opacity="0.02"/>
                    </linearGradient>
                </defs>
                <line x1="0" y1="${Math.round(H / 2)}" x2="${W}" y2="${Math.round(H / 2)}" stroke="rgba(148,163,184,0.16)" stroke-dasharray="2 2"/>
                <path d="${areaPath}" fill="url(#${gradId})"/>
                <path d="${linePath}" fill="none" stroke="${strokeColor}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
        `;
    }

    function renderFeaturedIndexCard(item) {
        const isUp = Number(item.chgPct) >= 0;
        const signSym = isUp ? '▲' : '▼';
        const signPlus = isUp ? '+' : '';
        const series = item.series || [item.price * 0.99, item.price];
        const maxY = Math.max(...series);
        const minY = Math.min(...series);
        const midY = (maxY + minY) / 2;
        const fmtN = (v) => Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

        return `
            <div class="mh-idx-card">
                <div>
                    <div class="mh-idx-name-row">
                        <span>${item.flag}</span>
                        <span>${esc(item.name)}</span>
                        <span class="mh-idx-status">· ${esc(item.status)}</span>
                    </div>
                    <div class="mh-idx-val-row" style="margin-top:3px;">
                        <span class="mh-idx-price">${fmtN(item.price)}</span>
                        <span class="mh-idx-chg ${isUp ? 'up' : 'down'}">${signSym} ${fmtN(Math.abs(item.chg))}(${signPlus}${Number(item.chgPct).toFixed(2)}%)</span>
                    </div>
                </div>

                <div class="mh-idx-chart-row">
                    <div class="mh-idx-svg-wrap">
                        ${buildIndexSparklineSvg(series, isUp)}
                        <div class="mh-idx-time-ticks">
                            ${(item.ticks || []).map(t => `<span>${esc(t)}</span>`).join('')}
                        </div>
                    </div>
                    <div class="mh-idx-yaxis">
                        <span>${fmtN(maxY)}</span>
                        <span>${fmtN(midY)}</span>
                        <span>${fmtN(minY)}</span>
                    </div>
                </div>

                <div class="mh-idx-meta-table">
                    <div class="mh-idx-meta-col">
                        <div class="mh-idx-meta-line"><span>52주 기준</span><span></span></div>
                        <div class="mh-idx-meta-line"><span>최고</span><b>${esc(item.high52)}</b></div>
                        <div class="mh-idx-meta-line"><span>최저</span><b>${esc(item.low52)}</b></div>
                    </div>
                    <div class="mh-idx-meta-col">
                        <div class="mh-idx-meta-line"><span>전일</span><b>${esc(item.prev)}</b></div>
                        <div class="mh-idx-meta-line"><span>고가</span><b class="up">${esc(item.high)}</b></div>
                        <div class="mh-idx-meta-line"><span>저가</span><b class="${isUp ? 'up' : 'down'}">${esc(item.low)}</b></div>
                    </div>
                </div>
            </div>
        `;
    }

    // 실시간 시세 동기화 (all_stocks.json + quant_hub_cache.json + 네이버 실시간 호가 API)
    function syncMainHomeLivePrices() {
        // 1. window.allStocks 가 이미 로드되어 있으면 KR_SECTOR_TREE에 즉시 반영
        if (Array.isArray(window.allStocks) && window.allStocks.length > 50) {
            const smap = new Map();
            window.allStocks.forEach(s => { if (s && s.code) smap.set(String(s.code), s); });
            KR_SECTOR_TREE.forEach(sec => {
                sec.stocks.forEach(st => {
                    const found = smap.get(st.code);
                    if (found) {
                        if (found.current_price > 0) st.price = found.current_price;
                        if (found.day1 !== null && found.day1 !== undefined && !isNaN(Number(found.day1))) {
                            st.chg = Number(found.day1);
                        }
                    }
                });
            });
        }

        // 2. quant_hub_cache.json의 market_view.us가 있으면 US_SECTOR_TREE에 반영
        if (homeState.quantCache && homeState.quantCache.market_view && Array.isArray(homeState.quantCache.market_view.us)) {
            const umap = new Map();
            homeState.quantCache.market_view.us.forEach(u => {
                if (u && u.ticker) umap.set(String(u.ticker).toUpperCase(), u);
            });
            US_SECTOR_TREE.forEach(sec => {
                sec.stocks.forEach(st => {
                    const found = umap.get(st.code);
                    if (found) {
                        if (found.price > 0) st.price = Number(found.price);
                        if (found.chg !== null && found.chg !== undefined && !isNaN(Number(found.chg))) {
                            st.chg = Number(found.chg);
                        }
                    }
                });
            });
        }

        if (homeState.liveSyncStarted) return;
        homeState.liveSyncStarted = true;

        // 3. 백엔드 실시간 네이버 호가 API (/api/stocks/realtime)로 국장 히트맵 전 종목 실시간 등락률 패치
        const allKrCodes = [];
        KR_SECTOR_TREE.forEach(sec => sec.stocks.forEach(s => allKrCodes.push(s.code)));
        fetch(`${API_BASE}/api/stocks/realtime?codes=${allKrCodes.join(',')}`)
            .then(r => r.ok ? r.json() : null)
            .then(data => {
                if (data && data.realtime && Object.keys(data.realtime).length > 0) {
                    const rmap = data.realtime;
                    let updated = false;
                    KR_SECTOR_TREE.forEach(sec => {
                        sec.stocks.forEach(st => {
                            const info = rmap[st.code];
                            if (info) {
                                if (info.current_price > 0) st.price = info.current_price;
                                if (info.day1 !== null && info.day1 !== undefined) {
                                    st.chg = Number(info.day1);
                                    updated = true;
                                }
                            }
                        });
                    });
                    const box = document.getElementById('main-home-dashboard');
                    if (updated && box && box.style.display !== 'none' && homeState.heatmapTab === 'KR') {
                        renderMainHomeDashboard();
                    }
                }
            })
            .catch(() => {});

        // 4. quant_hub_cache.json 비동기 로드
        const cb = Math.floor(Date.now() / 180000);
        fetch(`data/quant_hub_cache.json?t=${cb}`)
            .then(r => r.ok ? r.json() : null)
            .then(d => {
                if (d) {
                    homeState.quantCache = d;
                    syncMainHomeLivePrices();
                }
            })
            .catch(() => {});
    }

    function buildActiveSectorTree() {
        if (homeState.heatmapTab === 'US') {
            return US_SECTOR_TREE;
        }
        if (homeState.heatmapTab === 'THEME') {
            const themes = Array.isArray(window.allThemes) && window.allThemes.length > 0 ? window.allThemes : [];
            if (themes.length > 0) {
                const parseD1 = (t) => {
                    const n = parseFloat(String(t.day1 || '0').replace(/[%+,]/g, ''));
                    return isNaN(n) ? 0 : n;
                };
                const sorted = [...themes].sort((a, b) => Math.abs(parseD1(b)) - Math.abs(parseD1(a)));
                const topRising = sorted.filter(t => parseD1(t) >= 2.0).slice(0, 14).map((t, i) => ({
                    code: t.name, name: t.name, weight: Math.max(8, 28 - i * 1.4), chg: parseD1(t), isTheme: true
                }));
                const midRising = sorted.filter(t => parseD1(t) > 0 && parseD1(t) < 2.0).slice(0, 14).map((t, i) => ({
                    code: t.name, name: t.name, weight: Math.max(6, 20 - i), chg: parseD1(t), isTheme: true
                }));
                const falling = sorted.filter(t => parseD1(t) <= 0).slice(0, 12).map((t, i) => ({
                    code: t.name, name: t.name, weight: Math.max(6, 18 - i), chg: parseD1(t), isTheme: true
                }));
                const groups = [];
                if (topRising.length) groups.push({ sector: '🔥 당일 급등 주도 테마', weight: 220, stocks: topRising });
                if (midRising.length) groups.push({ sector: '📈 강세 · 순환매 유입 테마', weight: 150, stocks: midRising });
                if (falling.length) groups.push({ sector: '📉 차익실현 · 조정 테마', weight: 110, stocks: falling });
                if (groups.length > 0) return groups;
            }
        }
        return KR_SECTOR_TREE;
    }

    function renderTreemapHtml() {
        const tree = buildActiveSectorTree();
        const sectorRects = computeTreemapRects(tree, 0, 0, 100, 100);

        return sectorRects.map(sec => {
            const stockRects = computeTreemapRects(sec.stocks || [], 0, 0, 100, 100);
            const tilesHtml = stockRects.map(st => {
                const bg = getHeatmapColor(st.chg);
                const sign = Number(st.chg) > 0 ? '+' : '';
                const chgStr = `${sign}${Number(st.chg).toFixed(2)}%`;
                // 타일 면적에 따른 글자 크기 자동 스케일링
                const areaFactor = (sec.w * st.w * sec.h * st.h) / 10000;
                let nameSize = 11;
                let chgSize = 10;
                let showChg = true;
                let showName = true;
                if (areaFactor >= 120) { nameSize = 20; chgSize = 15; }
                else if (areaFactor >= 50) { nameSize = 16; chgSize = 13; }
                else if (areaFactor >= 22) { nameSize = 13.5; chgSize = 11.5; }
                else if (areaFactor >= 8) { nameSize = 11.5; chgSize = 10; }
                else if (areaFactor >= 3.2) { nameSize = 10; chgSize = 8.8; }
                else if (areaFactor >= 1.4) { nameSize = 9; showChg = false; }
                else { showName = false; showChg = false; }

                const pxInfo = st.isTheme ? '' : (homeState.heatmapTab === 'US' ? ` · $${st.price}` : ` · ${Number(st.price || 0).toLocaleString()}원`);
                const tip = `[${sec.sector}] ${st.name} (${chgStr}${pxInfo})`;

                return `
                    <div class="mh-tm-tile"
                         data-tm-code="${esc(st.code)}"
                         data-tm-name="${esc(st.name)}"
                         data-tm-theme="${st.isTheme ? '1' : '0'}"
                         title="${esc(tip)}"
                         style="left:${st.x.toFixed(2)}%; top:${st.y.toFixed(2)}%; width:${st.w.toFixed(2)}%; height:${st.h.toFixed(2)}%; background:${bg};">
                        ${showName ? `<span class="tm-name" style="font-size:${nameSize}px;">${esc(st.name)}</span>` : ''}
                        ${showChg ? `<span class="tm-chg" style="font-size:${chgSize}px;">${chgStr}</span>` : ''}
                    </div>
                `;
            }).join('');

            return `
                <div class="mh-tm-sector" style="left:${sec.x.toFixed(2)}%; top:${sec.y.toFixed(2)}%; width:${sec.w.toFixed(2)}%; height:${sec.h.toFixed(2)}%;">
                    <div class="mh-tm-sector-label">${esc(sec.sector)}</div>
                    <div class="mh-tm-sector-body">${tilesHtml}</div>
                </div>
            `;
        }).join('');
    }

    function renderMainHomeDashboard() {
        const box = document.getElementById('main-home-dashboard');
        if (!box) return;

        syncMainHomeLivePrices();

        const grp = INDEX_GROUPS[homeState.indexRegion] || INDEX_GROUPS.GLOBAL;

        box.innerHTML = `
            <!-- [1단] 당일 실시간 국내·글로벌 주요 증시 상황판 (참고 이미지 2 스타일) -->
            <div class="mh-section-block">
                <div class="mh-sec-header">
                    <h2 class="mh-sec-title">
                        <i class="ph-fill ph-chart-line-up" style="color:#38bdf8;"></i>
                        <span>실시간 글로벌 · 국내 주요 증시 상황판</span>
                    </h2>
                    <div class="al-pill-group">
                        <button type="button" class="al-pill-btn ${homeState.indexRegion === 'GLOBAL' ? 'active' : ''}" data-mh-idx-region="GLOBAL">
                            🇰🇷·🇺🇸 한·미·글로벌 대표 지수
                        </button>
                        <button type="button" class="al-pill-btn ${homeState.indexRegion === 'EUROPE' ? 'active' : ''}" data-mh-idx-region="EUROPE">
                            🇪🇺 유럽 주요 증시 상황판
                        </button>
                    </div>
                </div>

                <!-- 상단 4대 미니 스파크라인 지수 카드 -->
                <div class="mh-idx-top-grid">
                    ${grp.featured.map(item => renderFeaturedIndexCard(item)).join('')}
                </div>

                <!-- 하단 1대 미니 스파크라인 카드 + 3대 2x2 페어 지수 카드 (총 12개 세부 지수) -->
                <div class="mh-idx-bottom-grid">
                    ${renderFeaturedIndexCard(grp.bottomLeft)}
                    ${grp.pairs.map(pairArr => `
                        <div class="mh-idx-card" style="padding:10px;">
                            <div class="mh-idx-pair-grid">
                                ${pairArr.map(p => `
                                    <div class="mh-idx-mini-cell">
                                        <div style="font-size:11.5px; font-weight:800; color:#e2e8f0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                                            ${p.flag} ${esc(p.name)}
                                        </div>
                                        <div style="font-size:15.5px; font-weight:900; color:#f8fafc;">${esc(p.price)}</div>
                                        <div style="font-size:11px; font-weight:800; color:${p.up ? '#f43f5e' : '#38bdf8'};">${esc(p.chgText)}</div>
                                        <div style="font-size:10px; color:#64748b;">${esc(p.sub)}</div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>

            <!-- [2단] 당일 실시간 업종별 시가총액 히트맵 (참고 이미지 1 스타일) -->
            <div class="mh-section-block">
                <div class="mh-sec-header">
                    <div style="display:flex; align-items:center; gap:12px; flex-wrap:wrap;">
                        <h2 class="mh-sec-title">
                            <i class="ph-fill ph-squares-four" style="color:#f43f5e;"></i>
                            <span>당일 실시간 업종별 시가총액 히트맵 (Market Map)</span>
                        </h2>
                        <span style="font-size:12px; color:#94a3b8;">종목 박스를 클릭하면 상세 차트·수급 브리핑이 즉시 열립니다</span>
                    </div>

                    <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
                        <div class="mh-legend-bar">
                            <span class="mh-legend-chip" style="background:#1565c0;">-3%↓</span>
                            <span class="mh-legend-chip" style="background:#1d4c91;">-1%</span>
                            <span class="mh-legend-chip" style="background:#2c3242;">0%</span>
                            <span class="mh-legend-chip" style="background:#bd292a;">+1%</span>
                            <span class="mh-legend-chip" style="background:#e92928;">+3%↑</span>
                        </div>
                        <div class="al-pill-group">
                            <button type="button" class="al-pill-btn ${homeState.heatmapTab === 'KR' ? 'active' : ''}" data-mh-hm-tab="KR">
                                🇰🇷 국장 업종별 시총 히트맵
                            </button>
                            <button type="button" class="al-pill-btn ${homeState.heatmapTab === 'US' ? 'active' : ''}" data-mh-hm-tab="US">
                                🇺🇸 미장 빅테크·섹터 히트맵
                            </button>
                            <button type="button" class="al-pill-btn ${homeState.heatmapTab === 'THEME' ? 'active' : ''}" data-mh-hm-tab="THEME">
                                🔥 당일 주도 테마 히트맵
                            </button>
                        </div>
                    </div>
                </div>

                <div class="mh-treemap-viewport" id="mh-treemap-viewport">
                    ${renderTreemapHtml()}
                </div>
            </div>
        `;

        // 이벤트 바인딩
        box.querySelectorAll('[data-mh-idx-region]').forEach(btn => {
            btn.addEventListener('click', () => {
                homeState.indexRegion = btn.getAttribute('data-mh-idx-region');
                renderMainHomeDashboard();
            });
        });

        box.querySelectorAll('[data-mh-hm-tab]').forEach(btn => {
            btn.addEventListener('click', () => {
                homeState.heatmapTab = btn.getAttribute('data-mh-hm-tab');
                renderMainHomeDashboard();
            });
        });

        box.querySelectorAll('.mh-tm-tile').forEach(tile => {
            tile.addEventListener('click', () => {
                const code = tile.getAttribute('data-tm-code');
                const name = tile.getAttribute('data-tm-name');
                const isTheme = tile.getAttribute('data-tm-theme') === '1';

                if (isTheme) {
                    if (window.DajavataApp && typeof window.DajavataApp.openTheme === 'function') {
                        window.DajavataApp.openTheme(name);
                    }
                    return;
                }

                // 국내 종목은 실전 브리핑 모달 또는 AI 차트 스캐너 오픈
                if (/^\d{6}$/.test(code) && typeof window.openStockBriefingModal === 'function') {
                    const found = (window.allStocks || []).find(s => s && s.code === code);
                    if (found) {
                        window.openStockBriefingModal(found);
                        return;
                    }
                }
                if (typeof window.openInDajavataScanner === 'function') {
                    window.openInDajavataScanner(code, name);
                }
            });
        });
    }

    window.MainHome = {
        render: renderMainHomeDashboard
    };

    document.addEventListener('DOMContentLoaded', () => {
        loadCurrentUser();
        renderMainHomeDashboard();
        ensureCommunityDataLoaded().then(() => {
            syncHeaderAuthWidget();
        });

        // 첫 방문 트래킹 기록 (세션 최초 랜딩일 때만 외부 유입경로 카운트)
        trackVisitorActivity('홈페이지 메인 진입', true);

        // 사이드바 메뉴 클릭 시 방문 통계 및 헤더 동기화
        document.querySelectorAll('.menu-section li').forEach(li => {
            li.addEventListener('click', () => {
                const act = li.getAttribute('data-action') || '';
                if (!act.startsWith('community-')) {
                    window.CommunityHub.hide();
                    trackVisitorActivity(li.textContent.trim().slice(0, 24));
                }
            });
        });

        // URL 딥링크(?view=community&tab=...) 지원
        try {
            const params = new URLSearchParams(window.location.search);
            if (params.get('view') === 'community') {
                window.CommunityHub.navigate(params.get('tab') || 'community-vault');
            }
        } catch (e) {}
    });
})();
