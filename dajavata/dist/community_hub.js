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
    // 9. [🏠 다자바타 메인 홈] — 심플 2단 구성 (① 실시간 글로벌·국내 증시 상황판 + ② 218 국장 / 198 미장 / 140 테마 히트맵)
    //    * 국가별 현지 거래소 타임존(KST / 미 동부 ET / 유럽 CET·CEST 서머타임 자동 계산) 기반 실시간 개장·마감 판별 탑재
    // =========================================================================
    const homeState = {
        indexRegion: 'GLOBAL', // 'GLOBAL' | 'EUROPE'
        heatmapTab: 'KR',      // 'KR' (218종목) | 'US' (198종목) | 'THEME' (150테마)
        heatmapHeight: 1280,   // 920 | 1280 | 1680
        liveSyncStarted: false,
        autoRefreshTimer: null,
        quantCache: null
    };

    const INDEX_GROUPS = {"GLOBAL": {"featured": [{"id": "KOSPI", "flag": "🇰🇷", "name": "코스피 (KOSPI)", "mktType": "KR", "price": 4915.68, "chg": 204.47, "chgPct": 4.34, "high52": "9,385.59", "low52": "3,892.08", "prev": "4,711.21", "high": "4,922.94", "low": "4,682.43", "ticks": ["09:00", "11:30", "14:00", "15:30"], "series": [4719.7, 4733.15, 4784.36, 4793.73, 4806.54, 4836.05, 4855.87, 4877.52, 4899.71, 4892.55, 4900.34, 4915.68]}, {"id": "KOSDAQ", "flag": "🇰🇷", "name": "코스닥 (KOSDAQ)", "mktType": "KR", "price": 708.99, "chg": 58.35, "chgPct": 8.97, "high52": "1,229.42", "low52": "618.74", "prev": "650.64", "high": "710.90", "low": "664.52", "ticks": ["09:00", "11:30", "14:00", "15:30"], "series": [674.45, 682.91, 687.92, 693.17, 692.77, 691.33, 695.12, 696.82, 699.24, 700.37, 706.49, 708.99]}, {"id": "NASDAQ", "flag": "🇺🇸", "name": "나스닥 종합 (NASDAQ)", "mktType": "US", "price": 24129.5, "chg": 543.7, "chgPct": 2.31, "high52": "27,722.75", "low52": "20,690.25", "prev": "23,585.80", "high": "24,149.09", "low": "23,690.60", "ticks": ["23:30", "01:30", "03:30", "06:00"], "series": [23807.55, 23716.25, 23828.4, 23847.54, 23986.18, 23967.92, 23939.07, 23974.15, 24005.29, 24018.37, 24009.65, 24129.5]}, {"id": "SP500", "flag": "🇺🇸", "name": "S&P 500", "mktType": "US", "price": 7297.49, "chg": 114.71, "chgPct": 1.6, "high52": "7,844.52", "low52": "6,316.91", "prev": "7,182.78", "high": "7,304.10", "low": "7,211.46", "ticks": ["23:30", "01:30", "03:30", "06:00"], "series": [7240.2, 7215.57, 7238.12, 7245.17, 7271.75, 7267.99, 7260.62, 7269.5, 7278.21, 7281.03, 7276.14, 7297.49]}], "bottomLeft": {"id": "SOX", "flag": "🇺🇸", "name": "필라델피아 반도체", "mktType": "US", "price": 9186.71, "chg": 411.84, "chgPct": 4.69, "high52": "14,655.29", "low52": "6,680.68", "prev": "8,774.86", "high": "9,213.64", "low": "8,789.31", "ticks": ["23:30", "02:00", "05:00"], "series": [8887.52, 8866.89, 8947.85, 8934.32, 9026.54, 9015.31, 9026.94, 9061.98, 9082.59, 9072.81, 9078.41, 9186.71]}, "pairs": [[{"id": "DOW", "flag": "🇺🇸", "name": "다우존스 산업", "mktType": "US", "prefix": "", "suffix": "", "price": "50,774.94", "chgText": "▲ 591.99(+1.18%)", "up": true, "sub": "52주 최고 54,744.33"}, {"id": "N225", "flag": "🇯🇵", "name": "일본 닛케이 225", "mktType": "JP", "prefix": "", "suffix": "", "price": "58,711.11", "chgText": "▲ 1,211.95(+2.11%)", "up": true, "sub": "52주 최고 72,831.73"}, {"id": "RUT", "flag": "🇺🇸", "name": "러셀 2000", "mktType": "US", "prefix": "", "suffix": "", "price": "2,750.30", "chgText": "▲ 46.24(+1.71%)", "up": true, "sub": "52주 최고 3,069.71"}, {"id": "TWII", "flag": "🇹🇼", "name": "대만 가권", "mktType": "TW", "prefix": "", "suffix": "", "price": "39,308.08", "chgText": "▲ 1,112.68(+2.91%)", "up": true, "sub": "52주 최고 49,968.92"}], [{"id": "STOXX50", "flag": "🇪🇺", "name": "유로스톡스 50", "mktType": "EU", "prefix": "", "suffix": "", "price": "6,089.20", "chgText": "▲ 74.46(+1.24%)", "up": true, "sub": "52주 최고 6,577.20"}, {"id": "DAX", "flag": "🇩🇪", "name": "독일 DAX", "mktType": "EU", "prefix": "", "suffix": "", "price": "25,441.24", "chgText": "▲ 225.72(+0.90%)", "up": true, "sub": "52주 최고 27,001.67"}, {"id": "FTSE100", "flag": "🇬🇧", "name": "영국 FTSE 100", "mktType": "EU", "prefix": "", "suffix": "", "price": "10,698.81", "chgText": "▲ 89.51(+0.84%)", "up": true, "sub": "52주 최고 10,989.50"}, {"id": "CAC40", "flag": "🇫🇷", "name": "프랑스 CAC 40", "mktType": "EU", "prefix": "", "suffix": "", "price": "8,156.09", "chgText": "▲ 47.35(+0.58%)", "up": true, "sub": "52주 최고 8,755.03"}], [{"id": "USDKRW", "flag": "💵", "name": "원/달러 환율", "mktType": "FX24", "prefix": "", "suffix": "", "price": "1,333.00", "chgText": "▼ 10.06(-0.75%)", "up": false, "sub": "52주 최고 1,587.70"}, {"id": "US10Y", "flag": "🏦", "name": "미 국채 10년물", "mktType": "FX24", "prefix": "", "suffix": "%", "price": "4.94%", "chgText": "▲ 0.09(+1.86%)", "up": true, "sub": "52주 최고 5.36%"}, {"id": "GOLD", "flag": "🪙", "name": "국제 금 (Gold)", "mktType": "FX24", "prefix": "$", "suffix": "", "price": "$3,668.50", "chgText": "▲ 103.90(+2.91%)", "up": true, "sub": "52주 최고 $5,586.20"}, {"id": "WTI", "flag": "🛢️", "name": "WTI 원유 선물", "mktType": "FX24", "prefix": "$", "suffix": "", "price": "$83.08", "chgText": "▼ 0.60(-0.72%)", "up": false, "sub": "52주 최고 $119.48"}]]}, "EUROPE": {"featured": [{"id": "STOXX50", "flag": "🇪🇺", "name": "유로스톡스 50", "mktType": "EU", "price": 6089.2, "chg": 74.46, "chgPct": 1.24, "high52": "6,577.20", "low52": "5,376.81", "prev": "6,014.74", "high": "6,098.04", "low": "6,029.42", "ticks": ["10:45", "13:30", "16:15"], "series": [6081.87, 6084.27, 6093.1, 6090.62, 6085.32, 6093.35, 6093.95, 6078.48, 6073.1, 6077.77, 6090.02, 6089.2]}, {"id": "STOXX50F", "flag": "🇪🇺", "name": "유로스톡스 50 선물", "mktType": "EU_FUT", "price": 6089.2, "chg": 74.46, "chgPct": 1.24, "high52": "6,577.20", "low52": "5,376.81", "prev": "6,014.74", "high": "6,098.04", "low": "6,029.42", "ticks": ["06:30", "11:45", "17:45"], "series": [6081.87, 6084.27, 6093.1, 6090.62, 6085.32, 6093.35, 6093.95, 6078.48, 6073.1, 6077.77, 6090.02, 6089.2]}, {"id": "DAX", "flag": "🇩🇪", "name": "독일 DAX", "mktType": "EU", "price": 25441.24, "chg": 225.72, "chgPct": 0.9, "high52": "27,001.67", "low52": "21,863.81", "prev": "25,215.52", "high": "25,472.18", "low": "25,292.76", "ticks": ["10:45", "13:15", "15:45"], "series": [25409.67, 25437.98, 25451.93, 25433.81, 25405.22, 25429.79, 25437.38, 25375.31, 25355.46, 25362.59, 25405.33, 25441.24]}, {"id": "DAXF", "flag": "🇩🇪", "name": "독일 DAX 선물", "mktType": "EU_FUT", "price": 25441.24, "chg": 225.72, "chgPct": 0.9, "high52": "27,001.67", "low52": "21,863.81", "prev": "25,215.52", "high": "25,472.18", "low": "25,292.76", "ticks": ["06:30", "11:45", "17:45"], "series": [25409.67, 25437.98, 25451.93, 25433.81, 25405.22, 25429.79, 25437.38, 25375.31, 25355.46, 25362.59, 25405.33, 25441.24]}], "bottomLeft": {"id": "FTSE100", "flag": "🇬🇧", "name": "영국 FTSE 100", "mktType": "EU", "price": 10698.81, "chg": 89.51, "chgPct": 0.84, "high52": "10,989.50", "low52": "9,622.70", "prev": "10,609.30", "high": "10,714.10", "low": "10,609.16", "ticks": ["09:45", "12:15", "14:45"], "series": [10684.23, 10676.0, 10681.01, 10682.83, 10684.47, 10693.73, 10696.58, 10683.28, 10674.47, 10668.61, 10682.51, 10698.81]}, "pairs": [[{"id": "CAC40", "flag": "🇫🇷", "name": "프랑스 CAC 40", "mktType": "EU", "prefix": "", "suffix": "", "price": "8,156.09", "chgText": "▲ 47.35(+0.58%)", "up": true, "sub": "52주 최고 8,755.03"}, {"id": "FTSEMIB", "flag": "🇮🇹", "name": "이탈리아 FTSE MIB", "mktType": "EU", "prefix": "", "suffix": "", "price": "49,275.60", "chgText": "▲ 913.25(+1.89%)", "up": true, "sub": "52주 최고 54,042.00"}, {"id": "AEX", "flag": "🇳🇱", "name": "네덜란드 AEX", "mktType": "EU", "prefix": "", "suffix": "", "price": "1,096.67", "chgText": "▲ 13.41(+1.24%)", "up": true, "sub": "52주 최고 1,147.35"}, {"id": "BEL20", "flag": "🇧🇪", "name": "벨기에 BEL 20", "mktType": "EU", "prefix": "", "suffix": "", "price": "5,992.96", "chgText": "▲ 63.52(+1.07%)", "up": true, "sub": "52주 최고 6,144.44"}], [{"id": "IBEX35", "flag": "🇪🇸", "name": "스페인 IBEX 35", "mktType": "EU", "prefix": "", "suffix": "", "price": "19,386.60", "chgText": "▲ 328.70(+1.72%)", "up": true, "sub": "52주 최고 20,356.50"}, {"id": "PSI20", "flag": "🇵🇹", "name": "포르투갈 PSI 20", "mktType": "EU", "prefix": "", "suffix": "", "price": "9,489.66", "chgText": "▲ 112.62(+1.20%)", "up": true, "sub": "52주 최고 9,759.12"}, {"id": "ISEQ", "flag": "🇮🇪", "name": "아일랜드 ISEQ", "mktType": "EU", "prefix": "", "suffix": "", "price": "14,492.50", "chgText": "▲ 108.39(+0.75%)", "up": true, "sub": "52주 최고 15,144.35"}, {"id": "OMXC", "flag": "🇩🇰", "name": "덴마크 OMXC", "mktType": "EU", "prefix": "", "suffix": "", "price": "1,974.73", "chgText": "▲ 19.47(+1.00%)", "up": true, "sub": "52주 최고 2,044.63"}], [{"id": "OMXS", "flag": "🇸🇪", "name": "스웨덴 OMXS", "mktType": "EU", "prefix": "", "suffix": "", "price": "3,297.69", "chgText": "▲ 46.31(+1.42%)", "up": true, "sub": "52주 최고 3,373.51"}, {"id": "OMXH", "flag": "🇫🇮", "name": "핀란드 OMXH", "mktType": "EU", "prefix": "", "suffix": "", "price": "6,059.73", "chgText": "▲ 65.00(+1.08%)", "up": true, "sub": "52주 최고 6,663.46"}, {"id": "ATG", "flag": "🇬🇷", "name": "그리스 ATG", "mktType": "EU", "prefix": "", "suffix": "", "price": "2,512.83", "chgText": "▲ 32.89(+1.33%)", "up": true, "sub": "52주 최고 2,745.54"}, {"id": "BUX", "flag": "🇭🇺", "name": "헝가리 BUX", "mktType": "EU", "prefix": "", "suffix": "", "price": "139,814.53", "chgText": "▲ 3,854.98(+2.84%)", "up": true, "sub": "52주 최고 140,566.95"}]]}};

    const KR_SECTOR_TREE = [{"sector": "전기·전자 · 반도체", "weight": 24606.34, "stocks": [{"code": "005930", "name": "삼성전자", "weight": 8545.33, "chg": 4.79, "price": 179500.0}, {"code": "000660", "name": "SK하이닉스", "weight": 7264.5, "chg": 5.51, "price": 1111000.0}, {"code": "009150", "name": "삼성전기", "weight": 1744.47, "chg": 4.97, "price": 823000.0}, {"code": "066570", "name": "LG전자", "weight": 1025.31, "chg": 8.06, "price": 146100.0}, {"code": "042700", "name": "한미반도체", "weight": 801.39, "chg": 8.87, "price": 160800.0}, {"code": "036930", "name": "주성엔지니어링", "weight": 528.15, "chg": 14.14, "price": 156600.0}, {"code": "011070", "name": "LG이노텍", "weight": 497.56, "chg": 8.22, "price": 276500.0}, {"code": "007660", "name": "이수페타시스", "weight": 430.05, "chg": 5.86, "price": 68700.0}, {"code": "058470", "name": "리노공업", "weight": 376.96, "chg": 11.87, "price": 52300.0}, {"code": "039030", "name": "이오테크닉스", "weight": 366.04, "chg": 7.34, "price": 307000.0}, {"code": "240810", "name": "원익IPS", "weight": 346.05, "chg": 8.06, "price": 69700.0}, {"code": "403870", "name": "HPSP", "weight": 342.92, "chg": 8.78, "price": 40900.0}, {"code": "000990", "name": "DB하이텍", "weight": 326.03, "chg": 6.32, "price": 70700.0}, {"code": "095340", "name": "ISC", "weight": 301.78, "chg": 8.22, "price": 126400.0}, {"code": "357780", "name": "솔브레인", "weight": 260.57, "chg": 9.5, "price": 265000.0}, {"code": "084370", "name": "유진테크", "weight": 237.1, "chg": 8.57, "price": 76000.0}, {"code": "078600", "name": "대주전자재료", "weight": 215.87, "chg": 7.08, "price": 93800.0}, {"code": "036540", "name": "SFA반도체", "weight": 210.32, "chg": 4.52, "price": 8550.0}, {"code": "089030", "name": "테크윙", "weight": 201.34, "chg": 10.55, "price": 35100.0}, {"code": "131970", "name": "두산테스나", "weight": 195.93, "chg": 12.46, "price": 64100.0}, {"code": "001820", "name": "삼화콘덴서", "weight": 153.3, "chg": 3.78, "price": 76800.0}, {"code": "108320", "name": "LX세미콘", "weight": 100.68, "chg": 2.2, "price": 23200.0}, {"code": "200710", "name": "에이디테크놀로지", "weight": 74.63, "chg": -1.27, "price": 16390.0}, {"code": "092070", "name": "디엔에프", "weight": 60.06, "chg": 0.29, "price": 10450.0}]}, {"sector": "2차전지 · 에너지소재", "weight": 7301.86, "stocks": [{"code": "373220", "name": "LG에너지솔루션", "weight": 1934.58, "chg": 4.64, "price": 316000.0}, {"code": "006400", "name": "삼성SDI", "weight": 1302.12, "chg": 8.25, "price": 452500.0}, {"code": "003670", "name": "포스코퓨처엠", "weight": 806.3, "chg": 6.74, "price": 174200.0}, {"code": "086520", "name": "에코프로", "weight": 629.76, "chg": 14.69, "price": 73400.0}, {"code": "247540", "name": "에코프로비엠", "weight": 627.43, "chg": 13.32, "price": 91900.0}, {"code": "066970", "name": "엘앤에프", "weight": 321.18, "chg": 11.85, "price": 73600.0}, {"code": "020150", "name": "롯데에너지머티리얼즈", "weight": 272.36, "chg": 4.16, "price": 42600.0}, {"code": "014680", "name": "한솔케미칼", "weight": 261.36, "chg": 4.8, "price": 192000.0}, {"code": "450080", "name": "에코프로머티", "weight": 254.7, "chg": 11.8, "price": 27950.0}, {"code": "005070", "name": "코스모신소재", "weight": 183.56, "chg": 9.57, "price": 33200.0}, {"code": "361610", "name": "SK아이이테크놀로지", "weight": 172.61, "chg": 1.26, "price": 12100.0}, {"code": "093370", "name": "후성", "weight": 169.42, "chg": 0.34, "price": 8920.0}, {"code": "278280", "name": "천보", "weight": 98.95, "chg": 11.38, "price": 29850.0}, {"code": "005420", "name": "코스모화학", "weight": 91.3, "chg": 0.12, "price": 8270.0}, {"code": "117730", "name": "티로보틱스", "weight": 90.03, "chg": 9.69, "price": 13700.0}, {"code": "348370", "name": "엔켐", "weight": 86.2, "chg": -7.43, "price": 13090.0}]}, {"sector": "제약 · 바이오 · 헬스케어", "weight": 9280.29, "stocks": [{"code": "207940", "name": "삼성바이오로직스", "weight": 1758.42, "chg": 0.75, "price": 1347000.0}, {"code": "068270", "name": "셀트리온", "weight": 1576.41, "chg": 2.55, "price": 221000.0}, {"code": "196170", "name": "알테오젠", "weight": 734.11, "chg": 10.45, "price": 188100.0}, {"code": "326030", "name": "SK바이오팜", "weight": 542.8, "chg": 7.85, "price": 97600.0}, {"code": "128940", "name": "한미약품", "weight": 486.69, "chg": 5.25, "price": 491000.0}, {"code": "000100", "name": "유한양행", "weight": 478.84, "chg": 1.1, "price": 83000.0}, {"code": "000250", "name": "삼천당제약", "weight": 402.83, "chg": 14.96, "price": 191300.0}, {"code": "028300", "name": "HLB", "weight": 388.43, "chg": 8.79, "price": 31550.0}, {"code": "009420", "name": "한올바이오파마", "weight": 323.3, "chg": 4.69, "price": 58000.0}, {"code": "298380", "name": "에이비엘바이오", "weight": 301.94, "chg": 29.63, "price": 47900.0}, {"code": "145020", "name": "휴젤", "weight": 294.52, "chg": 0.96, "price": 210000.0}, {"code": "141080", "name": "리가켐바이오", "weight": 294.35, "chg": 22.05, "price": 69200.0}, {"code": "237690", "name": "에스티팜", "weight": 246.0, "chg": 13.21, "price": 89100.0}, {"code": "006280", "name": "녹십자", "weight": 221.15, "chg": 2.89, "price": 131600.0}, {"code": "214150", "name": "클래시스", "weight": 217.31, "chg": 7.03, "price": 22850.0}, {"code": "039200", "name": "오스코텍", "weight": 212.39, "chg": 6.7, "price": 37400.0}, {"code": "096530", "name": "씨젠", "weight": 197.55, "chg": 7.82, "price": 26900.0}, {"code": "069620", "name": "대웅제약", "weight": 183.59, "chg": 2.15, "price": 95200.0}, {"code": "185750", "name": "종근당", "weight": 156.08, "chg": -2.76, "price": 59800.0}, {"code": "214320", "name": "이노션", "weight": 140.76, "chg": -1.66, "price": 17160.0}, {"code": "314130", "name": "지놈앤컴퍼니", "weight": 62.54, "chg": 2.74, "price": 3000.0}, {"code": "084990", "name": "헬릭스미스", "weight": 60.28, "chg": 0.77, "price": 3275.0}]}, {"sector": "운송장비 · 자동차 · 부품", "weight": 6052.75, "stocks": [{"code": "005380", "name": "현대차", "weight": 1639.72, "chg": 4.44, "price": 270500.0}, {"code": "000270", "name": "기아", "weight": 1315.33, "chg": 1.49, "price": 95100.0}, {"code": "012330", "name": "현대모비스", "weight": 1179.01, "chg": 3.19, "price": 340000.0}, {"code": "161390", "name": "한국타이어앤테크놀로지", "weight": 535.86, "chg": -0.33, "price": 60300.0}, {"code": "018880", "name": "한온시스템", "weight": 336.13, "chg": 4.11, "price": 3165.0}, {"code": "005850", "name": "에스엘", "weight": 243.77, "chg": 4.65, "price": 39400.0}, {"code": "204320", "name": "HL만도", "weight": 234.62, "chg": 8.98, "price": 36400.0}, {"code": "011210", "name": "현대위아", "weight": 207.1, "chg": 2.65, "price": 50300.0}, {"code": "003620", "name": "KG모빌리티", "weight": 106.18, "chg": 1.66, "price": 2025.0}, {"code": "009900", "name": "명신산업", "weight": 95.8, "chg": 0.0, "price": 6580.0}, {"code": "060980", "name": "HL홀딩스", "weight": 87.96, "chg": 1.38, "price": 33100.0}, {"code": "010690", "name": "화신", "weight": 71.27, "chg": 2.26, "price": 5870.0}]}, {"sector": "조선 · 방산 · 우주항공", "weight": 7387.0, "stocks": [{"code": "012450", "name": "한화에어로스페이스", "weight": 1253.79, "chg": 5.42, "price": 661000.0}, {"code": "329180", "name": "HD현대중공업", "weight": 1082.99, "chg": 4.82, "price": 250000.0}, {"code": "009540", "name": "HD한국조선해양", "weight": 830.9, "chg": 3.59, "price": 231000.0}, {"code": "042660", "name": "한화오션", "weight": 749.19, "chg": 7.13, "price": 44350.0}, {"code": "010140", "name": "삼성중공업", "weight": 726.58, "chg": 5.18, "price": 14620.0}, {"code": "272210", "name": "한화시스템", "weight": 648.57, "chg": 13.35, "price": 55600.0}, {"code": "047810", "name": "한국항공우주", "weight": 634.09, "chg": 4.65, "price": 103500.0}, {"code": "079550", "name": "LIG디펜스앤에어로스페이스", "weight": 602.83, "chg": 7.44, "price": 419000.0}, {"code": "064350", "name": "현대로템", "weight": 508.38, "chg": 7.23, "price": 62300.0}, {"code": "103140", "name": "풍산", "weight": 205.65, "chg": 6.4, "price": 48200.0}, {"code": "003570", "name": "SNT다이내믹스", "weight": 144.03, "chg": -2.38, "price": 28700.0}]}, {"sector": "기계 · 원전 · 전력설비", "weight": 6681.06, "stocks": [{"code": "034020", "name": "두산에너빌리티", "weight": 1128.65, "chg": 8.89, "price": 44100.0}, {"code": "010120", "name": "LS ELECTRIC", "weight": 883.03, "chg": 7.14, "price": 121500.0}, {"code": "298040", "name": "효성중공업", "weight": 819.35, "chg": 6.01, "price": 1710000.0}, {"code": "267260", "name": "HD현대일렉트릭", "weight": 793.79, "chg": 7.87, "price": 418000.0}, {"code": "277810", "name": "레인보우로보틱스", "weight": 642.21, "chg": 13.92, "price": 532000.0}, {"code": "000150", "name": "두산", "weight": 560.77, "chg": 6.95, "price": 569000.0}, {"code": "241560", "name": "두산밥캣", "weight": 413.02, "chg": 2.41, "price": 48950.0}, {"code": "454910", "name": "두산로보틱스", "weight": 352.68, "chg": 5.61, "price": 54600.0}, {"code": "052690", "name": "한전기술", "weight": 290.77, "chg": 8.97, "price": 65600.0}, {"code": "112610", "name": "씨에스윈드", "weight": 235.17, "chg": 4.09, "price": 40700.0}, {"code": "071970", "name": "HD현대마린엔진", "weight": 189.78, "chg": 12.56, "price": 34500.0}, {"code": "004490", "name": "세방전지", "weight": 137.51, "chg": -0.52, "price": 47600.0}, {"code": "005880", "name": "대한해운", "weight": 135.27, "chg": 3.78, "price": 1978.0}, {"code": "033500", "name": "동성화인텍", "weight": 99.06, "chg": 6.08, "price": 12220.0}]}, {"sector": "기타금융 · 지주사", "weight": 8157.35, "stocks": [{"code": "402340", "name": "SK스퀘어", "weight": 2168.09, "chg": 5.37, "price": 687000.0}, {"code": "034730", "name": "SK", "weight": 1258.12, "chg": 10.0, "price": 473000.0}, {"code": "180640", "name": "한진칼", "weight": 846.22, "chg": 4.76, "price": 253000.0}, {"code": "003550", "name": "LG", "weight": 765.01, "chg": 2.64, "price": 93300.0}, {"code": "267250", "name": "HD현대", "weight": 609.76, "chg": 5.12, "price": 119100.0}, {"code": "078930", "name": "GS", "weight": 496.62, "chg": 2.63, "price": 70200.0}, {"code": "006260", "name": "LS", "weight": 439.0, "chg": 8.33, "price": 167700.0}, {"code": "036570", "name": "NC", "weight": 381.94, "chg": 1.83, "price": 189400.0}, {"code": "000880", "name": "한화", "weight": 368.86, "chg": 9.27, "price": 71900.0}, {"code": "001040", "name": "CJ", "weight": 364.89, "chg": 3.12, "price": 128900.0}, {"code": "004990", "name": "롯데지주", "weight": 267.67, "chg": 2.36, "price": 21700.0}, {"code": "012630", "name": "HDC", "weight": 191.17, "chg": 11.49, "price": 21050.0}]}, {"sector": "은행 · 금융지주", "weight": 8692.6, "stocks": [{"code": "105560", "name": "KB금융", "weight": 1581.68, "chg": 0.14, "price": 145500.0}, {"code": "055550", "name": "신한지주", "weight": 1349.82, "chg": -0.83, "price": 84000.0}, {"code": "086790", "name": "하나금융지주", "weight": 1207.3, "chg": -0.67, "price": 118400.0}, {"code": "316140", "name": "우리금융지주", "weight": 1003.78, "chg": -0.32, "price": 31100.0}, {"code": "138040", "name": "메리츠금융지주", "weight": 957.3, "chg": 2.44, "price": 125800.0}, {"code": "024110", "name": "기업은행", "weight": 788.0, "chg": 0.16, "price": 18650.0}, {"code": "323410", "name": "카카오뱅크", "weight": 654.89, "chg": 1.36, "price": 22400.0}, {"code": "175330", "name": "JB금융지주", "weight": 404.15, "chg": -0.62, "price": 24200.0}, {"code": "138930", "name": "BNK금융지주", "weight": 369.42, "chg": 0.4, "price": 12530.0}, {"code": "139130", "name": "iM금융지주", "weight": 285.46, "chg": 0.86, "price": 15320.0}, {"code": "006220", "name": "제주은행", "weight": 90.8, "chg": -1.31, "price": 8290.0}]}, {"sector": "IT 서비스 · 플랫폼 · AI", "weight": 4679.63, "stocks": [{"code": "035420", "name": "NAVER", "weight": 1077.98, "chg": 2.37, "price": 164000.0}, {"code": "018260", "name": "삼성에스디에스", "weight": 808.01, "chg": 4.09, "price": 201000.0}, {"code": "035720", "name": "카카오", "weight": 757.69, "chg": 3.64, "price": 31300.0}, {"code": "443060", "name": "HD현대마린솔루션", "weight": 575.06, "chg": 0.37, "price": 189000.0}, {"code": "032640", "name": "LG유플러스", "weight": 484.84, "chg": -1.08, "price": 14720.0}, {"code": "377300", "name": "카카오페이", "weight": 409.87, "chg": 6.05, "price": 34200.0}, {"code": "053800", "name": "안랩", "weight": 251.57, "chg": 5.78, "price": 174000.0}, {"code": "067160", "name": "SOOP", "weight": 101.23, "chg": 3.34, "price": 34050.0}, {"code": "030520", "name": "한컴", "weight": 93.26, "chg": 5.1, "price": 13610.0}, {"code": "214420", "name": "토니모리", "weight": 60.06, "chg": 7.28, "price": 4200.0}, {"code": "304100", "name": "솔트룩스", "weight": 60.06, "chg": 2.15, "price": 10950.0}]}, {"sector": "엔터 · 게임 · 미디어", "weight": 3232.41, "stocks": [{"code": "259960", "name": "크래프톤", "weight": 614.95, "chg": 0.0, "price": 210000.0}, {"code": "352820", "name": "하이브", "weight": 562.55, "chg": 1.78, "price": 189000.0}, {"code": "251270", "name": "넷마블", "weight": 298.23, "chg": 0.78, "price": 32250.0}, {"code": "041510", "name": "에스엠", "weight": 276.96, "chg": 0.2, "price": 100400.0}, {"code": "030000", "name": "제일기획", "weight": 255.64, "chg": 0.72, "price": 19670.0}, {"code": "263750", "name": "펄어비스", "weight": 249.25, "chg": 8.6, "price": 30300.0}, {"code": "035900", "name": "JYP Ent.", "weight": 240.29, "chg": 3.08, "price": 50200.0}, {"code": "293490", "name": "카카오게임즈", "weight": 212.62, "chg": 2.99, "price": 13430.0}, {"code": "122870", "name": "와이지엔터테인먼트", "weight": 167.88, "chg": 3.6, "price": 50300.0}, {"code": "079160", "name": "CJ CGV", "weight": 157.39, "chg": 2.53, "price": 5070.0}, {"code": "112040", "name": "위메이드", "weight": 121.73, "chg": 10.33, "price": 15600.0}, {"code": "034120", "name": "SBS", "weight": 74.92, "chg": 3.31, "price": 12170.0}]}, {"sector": "보험", "weight": 4078.3, "stocks": [{"code": "032830", "name": "삼성생명", "weight": 1502.77, "chg": 5.13, "price": 235500.0}, {"code": "000810", "name": "삼성화재", "weight": 1015.58, "chg": 2.14, "price": 524000.0}, {"code": "005830", "name": "DB손해보험", "weight": 650.46, "chg": -2.24, "price": 161200.0}, {"code": "088350", "name": "한화생명", "weight": 331.08, "chg": 4.3, "price": 3640.0}, {"code": "001450", "name": "현대해상", "weight": 316.4, "chg": 1.03, "price": 34200.0}, {"code": "003690", "name": "코리안리", "weight": 262.01, "chg": 1.38, "price": 11780.0}]}, {"sector": "증권", "weight": 3145.87, "stocks": [{"code": "006800", "name": "미래에셋증권", "weight": 720.67, "chg": 16.87, "price": 23350.0}, {"code": "005940", "name": "NH투자증권", "weight": 592.39, "chg": 9.26, "price": 24200.0}, {"code": "071050", "name": "한국금융지주", "weight": 557.79, "chg": 14.29, "price": 144000.0}, {"code": "016360", "name": "삼성증권", "weight": 505.6, "chg": 8.65, "price": 75400.0}, {"code": "039490", "name": "키움증권", "weight": 485.18, "chg": 16.91, "price": 238500.0}, {"code": "003540", "name": "대신증권", "weight": 174.3, "chg": 9.16, "price": 21800.0}, {"code": "001500", "name": "현대차증권", "weight": 109.94, "chg": 1.28, "price": 7140.0}]}, {"sector": "화학 · 정유", "weight": 4387.75, "stocks": [{"code": "096770", "name": "SK이노베이션", "weight": 829.9, "chg": 3.88, "price": 96500.0}, {"code": "051910", "name": "LG화학", "weight": 805.29, "chg": 5.04, "price": 219000.0}, {"code": "010950", "name": "S-Oil", "weight": 675.39, "chg": 2.14, "price": 100300.0}, {"code": "009830", "name": "한화솔루션", "weight": 411.75, "chg": 8.58, "price": 20750.0}, {"code": "011790", "name": "SKC", "weight": 343.3, "chg": 7.94, "price": 68000.0}, {"code": "011780", "name": "금호석유화학", "weight": 280.74, "chg": 3.05, "price": 94500.0}, {"code": "011170", "name": "롯데케미칼", "weight": 252.16, "chg": 4.0, "price": 45450.0}, {"code": "006120", "name": "SK디스커버리", "weight": 187.07, "chg": 1.87, "price": 65500.0}, {"code": "120110", "name": "코오롱인더", "weight": 180.12, "chg": 5.01, "price": 35600.0}, {"code": "004000", "name": "롯데정밀화학", "weight": 156.91, "chg": -0.15, "price": 32300.0}, {"code": "285130", "name": "SK케미칼", "weight": 137.7, "chg": 0.0, "price": 38150.0}, {"code": "006650", "name": "대한유화", "weight": 127.42, "chg": 2.91, "price": 88400.0}]}, {"sector": "철강 · 비철금속", "weight": 2755.89, "stocks": [{"code": "005490", "name": "POSCO홀딩스", "weight": 941.72, "chg": 3.82, "price": 258000.0}, {"code": "010130", "name": "고려아연", "weight": 846.68, "chg": 5.74, "price": 810000.0}, {"code": "004020", "name": "현대제철", "weight": 356.97, "chg": 3.44, "price": 27100.0}, {"code": "103590", "name": "일진전기", "weight": 294.53, "chg": 6.75, "price": 53800.0}, {"code": "016380", "name": "KG스틸", "weight": 109.25, "chg": -1.13, "price": 4365.0}, {"code": "001230", "name": "동국홀딩스", "weight": 80.8, "chg": 0.24, "price": 1645.0}, {"code": "008490", "name": "서흥", "weight": 65.87, "chg": -1.55, "price": 15220.0}, {"code": "005010", "name": "휴스틸", "weight": 60.07, "chg": 0.38, "price": 2670.0}]}, {"sector": "유통 · 상사 · 소비재", "weight": 4333.89, "stocks": [{"code": "028260", "name": "삼성물산", "weight": 1409.38, "chg": 5.5, "price": 259000.0}, {"code": "047050", "name": "포스코인터내셔널", "weight": 572.95, "chg": 2.79, "price": 47850.0}, {"code": "021240", "name": "코웨이", "weight": 514.33, "chg": -1.6, "price": 98100.0}, {"code": "004170", "name": "신세계", "weight": 289.57, "chg": -4.01, "price": 263500.0}, {"code": "023530", "name": "롯데쇼핑", "weight": 270.5, "chg": -1.89, "price": 77900.0}, {"code": "069960", "name": "현대백화점", "weight": 243.03, "chg": -5.59, "price": 84400.0}, {"code": "007070", "name": "GS리테일", "weight": 241.34, "chg": -1.6, "price": 21500.0}, {"code": "139480", "name": "이마트", "weight": 239.03, "chg": 2.67, "price": 65400.0}, {"code": "081660", "name": "미스토홀딩스", "weight": 237.49, "chg": -0.3, "price": 32900.0}, {"code": "008770", "name": "호텔신라", "weight": 220.57, "chg": 0.65, "price": 39000.0}, {"code": "031430", "name": "신세계인터내셔날", "weight": 95.7, "chg": 1.13, "price": 9850.0}]}, {"sector": "음식료 · 담배 · 화장품", "weight": 4609.06, "stocks": [{"code": "033780", "name": "KT&G", "weight": 885.95, "chg": -1.62, "price": 176600.0}, {"code": "003230", "name": "삼양식품", "weight": 624.14, "chg": -0.99, "price": 1302000.0}, {"code": "090430", "name": "아모레퍼시픽", "weight": 570.01, "chg": -2.4, "price": 142600.0}, {"code": "271560", "name": "오리온", "weight": 405.75, "chg": -3.52, "price": 115000.0}, {"code": "051900", "name": "LG생활건강", "weight": 365.59, "chg": 1.0, "price": 252000.0}, {"code": "192820", "name": "코스맥스", "weight": 354.05, "chg": -6.69, "price": 314000.0}, {"code": "097950", "name": "CJ제일제당", "weight": 311.28, "chg": -1.0, "price": 188100.0}, {"code": "002790", "name": "아모레퍼시픽홀딩스", "weight": 269.07, "chg": -1.72, "price": 28550.0}, {"code": "004370", "name": "농심", "weight": 264.47, "chg": -1.0, "price": 348000.0}, {"code": "241710", "name": "코스메카코리아", "weight": 201.91, "chg": -4.37, "price": 122400.0}, {"code": "000080", "name": "하이트진로", "weight": 186.4, "chg": -0.68, "price": 16160.0}, {"code": "005300", "name": "롯데칠성", "weight": 170.44, "chg": 1.26, "price": 104100.0}]}, {"sector": "운송 · 해운 · 항공", "weight": 3309.32, "stocks": [{"code": "011200", "name": "HMM", "weight": 958.04, "chg": 0.9, "price": 22350.0}, {"code": "086280", "name": "현대글로비스", "weight": 795.11, "chg": 1.72, "price": 201500.0}, {"code": "003490", "name": "대한항공", "weight": 668.99, "chg": 1.52, "price": 30150.0}, {"code": "028670", "name": "팬오션", "weight": 299.0, "chg": 2.92, "price": 4930.0}, {"code": "020560", "name": "아시아나항공", "weight": 231.64, "chg": 1.0, "price": 8110.0}, {"code": "000120", "name": "CJ대한통운", "weight": 225.31, "chg": 0.0, "price": 69700.0}, {"code": "089590", "name": "제주항공", "weight": 131.23, "chg": 1.61, "price": 7570.0}]}, {"sector": "통신 · 전기가스 · 건설", "weight": 4854.17, "stocks": [{"code": "015760", "name": "한국전력", "weight": 843.32, "chg": 2.35, "price": 26150.0}, {"code": "017670", "name": "SK텔레콤", "weight": 764.53, "chg": 1.71, "price": 65600.0}, {"code": "028050", "name": "삼성E&A", "weight": 681.85, "chg": 3.17, "price": 58600.0}, {"code": "030200", "name": "KT", "weight": 675.34, "chg": -2.4, "price": 44800.0}, {"code": "000720", "name": "현대건설", "weight": 557.53, "chg": 7.46, "price": 72000.0}, {"code": "047040", "name": "대우건설", "weight": 393.21, "chg": 6.84, "price": 10460.0}, {"code": "036460", "name": "한국가스공사", "weight": 338.34, "chg": -0.14, "price": 35600.0}, {"code": "006360", "name": "GS건설", "weight": 277.49, "chg": 6.73, "price": 26950.0}, {"code": "375500", "name": "DL이앤씨", "weight": 238.69, "chg": 3.76, "price": 45550.0}, {"code": "017390", "name": "서울가스", "weight": 83.87, "chg": -0.18, "price": 55000.0}]}];

    const US_SECTOR_TREE = [{"sector": "반도체 · AI 하드웨어", "weight": 328.24, "stocks": [{"code": "AVGO", "name": "AVGO", "fullName": "Broadcom Inc.", "weight": 58.62, "chg": -0.07, "price": 300.86}, {"code": "AMD", "name": "AMD", "fullName": "Advanced Micro Devices, Inc.", "weight": 38.12, "chg": -1.75, "price": 406.03}, {"code": "ASML", "name": "ASML", "fullName": "ASML Holding N.V.", "weight": 32.55, "chg": -2.47, "price": 1303.08}, {"code": "INTC", "name": "INTC", "fullName": "Intel Corp.", "weight": 23.91, "chg": -0.6, "price": 54.47}, {"code": "AMAT", "name": "AMAT", "fullName": "Applied Materials, Inc.", "weight": 21.87, "chg": -3.89, "price": 311.18}, {"code": "ARM", "name": "ARM", "fullName": "Arm Holdings plc American Depositary Shares", "weight": 17.91, "chg": -0.03, "price": 161.51}, {"code": "ADI", "name": "ADI", "fullName": "Analog Devices, Inc.", "weight": 17.24, "chg": 6.44, "price": 333.11}, {"code": "NVDA", "name": "NVDA", "fullName": "NVDA", "weight": 8.43, "chg": 0.45, "price": 120.0}, {"code": "TSM", "name": "TSM", "fullName": "TSM", "weight": 8.43, "chg": 0.45, "price": 120.0}, {"code": "QCOM", "name": "QCOM", "fullName": "QCOM", "weight": 8.43, "chg": 0.45, "price": 120.0}, {"code": "TXN", "name": "TXN", "fullName": "TXN", "weight": 8.43, "chg": 0.45, "price": 120.0}, {"code": "MU", "name": "MU", "fullName": "MU", "weight": 8.43, "chg": 0.45, "price": 120.0}, {"code": "LRCX", "name": "LRCX", "fullName": "LRCX", "weight": 8.43, "chg": 0.45, "price": 120.0}, {"code": "KLAC", "name": "KLAC", "fullName": "KLAC", "weight": 8.43, "chg": 0.45, "price": 120.0}, {"code": "MRVL", "name": "MRVL", "fullName": "MRVL", "weight": 8.43, "chg": 0.45, "price": 120.0}, {"code": "NXPI", "name": "NXPI", "fullName": "NXPI", "weight": 8.43, "chg": 0.45, "price": 120.0}, {"code": "MPWR", "name": "MPWR", "fullName": "MPWR", "weight": 8.43, "chg": 0.45, "price": 120.0}, {"code": "ON", "name": "ON", "fullName": "ON", "weight": 8.43, "chg": 0.45, "price": 120.0}, {"code": "MCHP", "name": "MCHP", "fullName": "MCHP", "weight": 8.43, "chg": 0.45, "price": 120.0}, {"code": "TER", "name": "TER", "fullName": "TER", "weight": 8.43, "chg": 0.45, "price": 120.0}, {"code": "SMCI", "name": "SMCI", "fullName": "SMCI", "weight": 8.43, "chg": 0.45, "price": 120.0}]}, {"sector": "빅테크 · 소프트웨어 · 클라우드", "weight": 374.49, "stocks": [{"code": "AAPL", "name": "AAPL", "fullName": "Apple Inc.", "weight": 120.07, "chg": 0.43, "price": 355.58}, {"code": "IBM", "name": "IBM", "fullName": "International Business Machines Corporation", "weight": 21.02, "chg": 3.33, "price": 243.47}, {"code": "CRWD", "name": "CRWD", "fullName": "CrowdStrike Holdings, Inc.", "weight": 20.27, "chg": -0.74, "price": 209.3}, {"code": "ANET", "name": "ANET", "fullName": "Arista Networks, Inc.", "weight": 19.82, "chg": -2.71, "price": 163.99}, {"code": "DELL", "name": "DELL", "fullName": "Dell Technologies Inc.", "weight": 18.82, "chg": 0.6, "price": 297.06}, {"code": "CRM", "name": "CRM", "fullName": "Salesforce, Inc.", "weight": 17.29, "chg": 2.04, "price": 197.21}, {"code": "ADP", "name": "ADP", "fullName": "Automatic Data Processing, Inc.", "weight": 14.94, "chg": 1.91, "price": 316.72}, {"code": "FTNT", "name": "FTNT", "fullName": "Fortinet, Inc.", "weight": 13.12, "chg": 1.86, "price": 134.96}, {"code": "ADBE", "name": "ADBE", "fullName": "Adobe Inc.", "weight": 12.47, "chg": 0.32, "price": 232.83}, {"code": "CDNS", "name": "CDNS", "fullName": "Cadence Design Systems, Inc.", "weight": 11.71, "chg": -0.58, "price": 294.89}, {"code": "INTU", "name": "INTU", "fullName": "Intuit Inc.", "weight": 11.02, "chg": -2.76, "price": 271.72}, {"code": "DDOG", "name": "DDOG", "fullName": "Datadog, Inc.", "weight": 9.64, "chg": -4.31, "price": 158.25}, {"code": "MSFT", "name": "MSFT", "fullName": "MSFT", "weight": 8.43, "chg": 0.45, "price": 120.0}, {"code": "ORCL", "name": "ORCL", "fullName": "ORCL", "weight": 8.43, "chg": 0.45, "price": 120.0}, {"code": "NOW", "name": "NOW", "fullName": "NOW", "weight": 8.43, "chg": 0.45, "price": 120.0}, {"code": "PLTR", "name": "PLTR", "fullName": "PLTR", "weight": 8.43, "chg": 0.45, "price": 120.0}, {"code": "PANW", "name": "PANW", "fullName": "PANW", "weight": 8.43, "chg": 0.45, "price": 120.0}, {"code": "SNPS", "name": "SNPS", "fullName": "SNPS", "weight": 8.43, "chg": 0.45, "price": 120.0}, {"code": "WDAY", "name": "WDAY", "fullName": "WDAY", "weight": 8.43, "chg": 0.45, "price": 120.0}, {"code": "TEAM", "name": "TEAM", "fullName": "TEAM", "weight": 8.43, "chg": 0.45, "price": 120.0}, {"code": "SNOW", "name": "SNOW", "fullName": "SNOW", "weight": 8.43, "chg": 0.45, "price": 120.0}, {"code": "ZS", "name": "ZS", "fullName": "ZS", "weight": 8.43, "chg": 0.45, "price": 120.0}]}, {"sector": "인터넷 · 플랫폼 · 미디어", "weight": 288.78, "stocks": [{"code": "GOOGL", "name": "GOOGL", "fullName": "Alphabet Inc.", "weight": 93.89, "chg": -2.13, "price": 273.1}, {"code": "DIS", "name": "DIS", "fullName": "The Walt Disney Company", "weight": 20.21, "chg": 2.52, "price": 125.6}, {"code": "APP", "name": "APP", "fullName": "AppLovin Corporation", "weight": 14.2, "chg": -0.57, "price": 378.95}, {"code": "BKNG", "name": "BKNG", "fullName": "Booking Holdings Inc.", "weight": 13.99, "chg": 1.95, "price": 149.5}, {"code": "ABNB", "name": "ABNB", "fullName": "Airbnb, Inc.", "weight": 13.38, "chg": -0.72, "price": 172.15}, {"code": "CMCSA", "name": "CMCSA", "fullName": "Comcast Corporation", "weight": 12.51, "chg": 1.38, "price": 25.73}, {"code": "DASH", "name": "DASH", "fullName": "DoorDash, Inc.", "weight": 11.01, "chg": 3.92, "price": 166.4}, {"code": "META", "name": "META", "fullName": "META", "weight": 8.43, "chg": 0.45, "price": 120.0}, {"code": "NFLX", "name": "NFLX", "fullName": "NFLX", "weight": 8.43, "chg": 0.45, "price": 120.0}, {"code": "TMUS", "name": "TMUS", "fullName": "TMUS", "weight": 8.43, "chg": 0.45, "price": 120.0}, {"code": "VZ", "name": "VZ", "fullName": "VZ", "weight": 8.43, "chg": 0.45, "price": 120.0}, {"code": "T", "name": "T", "fullName": "T", "weight": 8.43, "chg": 0.45, "price": 120.0}, {"code": "SPOT", "name": "SPOT", "fullName": "SPOT", "weight": 8.43, "chg": 0.45, "price": 120.0}, {"code": "UBER", "name": "UBER", "fullName": "UBER", "weight": 8.43, "chg": 0.45, "price": 120.0}, {"code": "TTD", "name": "TTD", "fullName": "TTD", "weight": 8.43, "chg": 0.45, "price": 120.0}, {"code": "RBLX", "name": "RBLX", "fullName": "RBLX", "weight": 8.43, "chg": 0.45, "price": 120.0}, {"code": "PINS", "name": "PINS", "fullName": "PINS", "weight": 8.43, "chg": 0.45, "price": 120.0}, {"code": "SNAP", "name": "SNAP", "fullName": "SNAP", "weight": 8.43, "chg": 0.45, "price": 120.0}, {"code": "EA", "name": "EA", "fullName": "EA", "weight": 8.43, "chg": 0.45, "price": 120.0}, {"code": "TTWO", "name": "TTWO", "fullName": "TTWO", "weight": 8.43, "chg": 0.45, "price": 120.0}]}, {"sector": "전자상거래 · 전기차 · 소비재", "weight": 268.29, "stocks": [{"code": "AMZN", "name": "AMZN", "fullName": "Amazon.com, Inc.", "weight": 82.49, "chg": -3.12, "price": 244.43}, {"code": "HD", "name": "HD", "fullName": "The Home Depot, Inc.", "weight": 27.03, "chg": 2.14, "price": 361.26}, {"code": "HLT", "name": "HLT", "fullName": "Hilton Worldwide Holdings Inc.", "weight": 11.75, "chg": 0.52, "price": 366.2}, {"code": "GM", "name": "GM", "fullName": "General Motors Company", "weight": 10.87, "chg": 2.03, "price": 83.99}, {"code": "AZO", "name": "AZO", "fullName": "AutoZone, Inc.", "weight": 9.41, "chg": 1.45, "price": 3404.46}, {"code": "F", "name": "F", "fullName": "Ford Motor Company", "weight": 8.8, "chg": 1.84, "price": 12.17}, {"code": "CMG", "name": "CMG", "fullName": "Chipotle Mexican Grill, Inc.", "weight": 8.67, "chg": 0.94, "price": 37.4}, {"code": "TSLA", "name": "TSLA", "fullName": "TSLA", "weight": 8.43, "chg": 0.45, "price": 120.0}, {"code": "MCD", "name": "MCD", "fullName": "MCD", "weight": 8.43, "chg": 0.45, "price": 120.0}, {"code": "NKE", "name": "NKE", "fullName": "NKE", "weight": 8.43, "chg": 0.45, "price": 120.0}, {"code": "LOW", "name": "LOW", "fullName": "LOW", "weight": 8.43, "chg": 0.45, "price": 120.0}, {"code": "SBUX", "name": "SBUX", "fullName": "SBUX", "weight": 8.43, "chg": 0.45, "price": 120.0}, {"code": "TJX", "name": "TJX", "fullName": "TJX", "weight": 8.43, "chg": 0.45, "price": 120.0}, {"code": "MAR", "name": "MAR", "fullName": "MAR", "weight": 8.43, "chg": 0.45, "price": 120.0}, {"code": "ORLY", "name": "ORLY", "fullName": "ORLY", "weight": 8.43, "chg": 0.45, "price": 120.0}, {"code": "ROST", "name": "ROST", "fullName": "ROST", "weight": 8.43, "chg": 0.45, "price": 120.0}, {"code": "YUM", "name": "YUM", "fullName": "YUM", "weight": 8.43, "chg": 0.45, "price": 120.0}, {"code": "LEN", "name": "LEN", "fullName": "LEN", "weight": 8.43, "chg": 0.45, "price": 120.0}, {"code": "LULU", "name": "LULU", "fullName": "LULU", "weight": 8.43, "chg": 0.45, "price": 120.0}, {"code": "DHI", "name": "DHI", "fullName": "D.R. Horton, Inc.", "weight": 8.11, "chg": 3.09, "price": 156.87}]}, {"sector": "금융 · 은행 · 결제", "weight": 270.5, "stocks": [{"code": "BAC", "name": "BAC", "fullName": "Bank of America Corporation", "weight": 25.94, "chg": -0.04, "price": 48.54}, {"code": "GS", "name": "GS", "fullName": "The Goldman Sachs Group, Inc.", "weight": 21.07, "chg": -0.62, "price": 801.03}, {"code": "AXP", "name": "AXP", "fullName": "American Express Company", "weight": 19.94, "chg": 1.22, "price": 312.39}, {"code": "C", "name": "C", "fullName": "Citigroup Inc.", "weight": 18.75, "chg": -0.46, "price": 113.33}, {"code": "BLK", "name": "BLK", "fullName": "BlackRock, Inc.", "weight": 18.11, "chg": -0.36, "price": 1141.86}, {"code": "CB", "name": "CB", "fullName": "Chubb Limited", "weight": 16.26, "chg": 1.37, "price": 380.51}, {"code": "BX", "name": "BX", "fullName": "Blackstone Inc.", "weight": 15.72, "chg": -0.34, "price": 118.95}, {"code": "CME", "name": "CME", "fullName": "CME Group Inc.", "weight": 14.02, "chg": 0.81, "price": 311.74}, {"code": "ICE", "name": "ICE", "fullName": "Intercontinental Exchange, Inc.", "weight": 13.14, "chg": 1.67, "price": 177.81}, {"code": "BRK.B", "name": "BRK.B", "fullName": "BRK.B", "weight": 8.43, "chg": 0.45, "price": 120.0}, {"code": "JPM", "name": "JPM", "fullName": "JPM", "weight": 8.43, "chg": 0.45, "price": 120.0}, {"code": "V", "name": "V", "fullName": "V", "weight": 8.43, "chg": 0.45, "price": 120.0}, {"code": "MA", "name": "MA", "fullName": "MA", "weight": 8.43, "chg": 0.45, "price": 120.0}, {"code": "WFC", "name": "WFC", "fullName": "WFC", "weight": 8.43, "chg": 0.45, "price": 120.0}, {"code": "MS", "name": "MS", "fullName": "MS", "weight": 8.43, "chg": 0.45, "price": 120.0}, {"code": "SPGI", "name": "SPGI", "fullName": "SPGI", "weight": 8.43, "chg": 0.45, "price": 120.0}, {"code": "PGR", "name": "PGR", "fullName": "PGR", "weight": 8.43, "chg": 0.45, "price": 120.0}, {"code": "MMC", "name": "MMC", "fullName": "MMC", "weight": 8.43, "chg": 0.45, "price": 120.0}, {"code": "SCHW", "name": "SCHW", "fullName": "SCHW", "weight": 8.43, "chg": 0.45, "price": 120.0}, {"code": "KKR", "name": "KKR", "fullName": "KKR", "weight": 8.43, "chg": 0.45, "price": 120.0}, {"code": "PYPL", "name": "PYPL", "fullName": "PYPL", "weight": 8.43, "chg": 0.45, "price": 120.0}, {"code": "COIN", "name": "COIN", "fullName": "Coinbase Global, Inc.", "weight": 6.39, "chg": 1.34, "price": 103.72}]}, {"sector": "헬스케어 · 제약 · 바이오", "weight": 282.63, "stocks": [{"code": "ABBV", "name": "ABBV", "fullName": "AbbVie Inc.", "weight": 33.21, "chg": -1.93, "price": 294.48}, {"code": "AMGN", "name": "AMGN", "fullName": "Amgen Inc.", "weight": 22.21, "chg": -0.99, "price": 469.24}, {"code": "GILD", "name": "GILD", "fullName": "Gilead Sciences, Inc.", "weight": 20.46, "chg": -0.87, "price": 176.74}, {"code": "ABT", "name": "ABT", "fullName": "Abbott Laboratories", "weight": 18.72, "chg": 2.48, "price": 108.0}, {"code": "DHR", "name": "DHR", "fullName": "Danaher Corporation", "weight": 17.15, "chg": -0.76, "price": 227.35}, {"code": "ISRG", "name": "ISRG", "fullName": "Intuitive Surgical, Inc.", "weight": 16.42, "chg": -1.68, "price": 427.18}, {"code": "BMY", "name": "BMY", "fullName": "Bristol-Myers Squibb Company", "weight": 14.99, "chg": -0.74, "price": 61.56}, {"code": "CVS", "name": "CVS", "fullName": "CVS Health Corp.", "weight": 13.45, "chg": 0.46, "price": 81.06}, {"code": "ELV", "name": "ELV", "fullName": "Elevance Health Inc.", "weight": 11.97, "chg": -0.38, "price": 389.7}, {"code": "CI", "name": "CI", "fullName": "Cigna Corporation", "weight": 10.93, "chg": -1.3, "price": 271.42}, {"code": "BSX", "name": "BSX", "fullName": "Boston Scientific Corporation", "weight": 10.39, "chg": 2.22, "price": 45.12}, {"code": "LLY", "name": "LLY", "fullName": "LLY", "weight": 8.43, "chg": 0.45, "price": 120.0}, {"code": "UNH", "name": "UNH", "fullName": "UNH", "weight": 8.43, "chg": 0.45, "price": 120.0}, {"code": "JNJ", "name": "JNJ", "fullName": "JNJ", "weight": 8.43, "chg": 0.45, "price": 120.0}, {"code": "MRK", "name": "MRK", "fullName": "MRK", "weight": 8.43, "chg": 0.45, "price": 120.0}, {"code": "TMO", "name": "TMO", "fullName": "TMO", "weight": 8.43, "chg": 0.45, "price": 120.0}, {"code": "PFE", "name": "PFE", "fullName": "PFE", "weight": 8.43, "chg": 0.45, "price": 120.0}, {"code": "SYK", "name": "SYK", "fullName": "SYK", "weight": 8.43, "chg": 0.45, "price": 120.0}, {"code": "VRTX", "name": "VRTX", "fullName": "VRTX", "weight": 8.43, "chg": 0.45, "price": 120.0}, {"code": "REGN", "name": "REGN", "fullName": "REGN", "weight": 8.43, "chg": 0.45, "price": 120.0}, {"code": "MDT", "name": "MDT", "fullName": "MDT", "weight": 8.43, "chg": 0.45, "price": 120.0}, {"code": "ZTS", "name": "ZTS", "fullName": "ZTS", "weight": 8.43, "chg": 0.45, "price": 120.0}]}, {"sector": "필수소비재 · 유통", "weight": 174.16, "stocks": [{"code": "COST", "name": "COST", "fullName": "Costco Wholesale Corporation", "weight": 31.79, "chg": -0.45, "price": 1086.81}, {"code": "CL", "name": "CL", "fullName": "Colgate-Palmolive Company", "weight": 11.57, "chg": 0.42, "price": 99.66}, {"code": "WMT", "name": "WMT", "fullName": "WMT", "weight": 8.43, "chg": 0.45, "price": 120.0}, {"code": "PG", "name": "PG", "fullName": "PG", "weight": 8.43, "chg": 0.45, "price": 120.0}, {"code": "KO", "name": "KO", "fullName": "KO", "weight": 8.43, "chg": 0.45, "price": 120.0}, {"code": "PEP", "name": "PEP", "fullName": "PEP", "weight": 8.43, "chg": 0.45, "price": 120.0}, {"code": "PM", "name": "PM", "fullName": "PM", "weight": 8.43, "chg": 0.45, "price": 120.0}, {"code": "MO", "name": "MO", "fullName": "MO", "weight": 8.43, "chg": 0.45, "price": 120.0}, {"code": "MDLZ", "name": "MDLZ", "fullName": "MDLZ", "weight": 8.43, "chg": 0.45, "price": 120.0}, {"code": "TGT", "name": "TGT", "fullName": "TGT", "weight": 8.43, "chg": 0.45, "price": 120.0}, {"code": "KMB", "name": "KMB", "fullName": "KMB", "weight": 8.43, "chg": 0.45, "price": 120.0}, {"code": "SYY", "name": "SYY", "fullName": "SYY", "weight": 8.43, "chg": 0.45, "price": 120.0}, {"code": "KR", "name": "KR", "fullName": "KR", "weight": 8.43, "chg": 0.45, "price": 120.0}, {"code": "MNST", "name": "MNST", "fullName": "MNST", "weight": 8.43, "chg": 0.45, "price": 120.0}, {"code": "STZ", "name": "STZ", "fullName": "STZ", "weight": 8.43, "chg": 0.45, "price": 120.0}, {"code": "KHC", "name": "KHC", "fullName": "KHC", "weight": 8.43, "chg": 0.45, "price": 120.0}, {"code": "HSY", "name": "HSY", "fullName": "The Hershey Company", "weight": 7.52, "chg": 3.4, "price": 182.57}, {"code": "GIS", "name": "GIS", "fullName": "General Mills, Inc.", "weight": 5.26, "chg": 1.85, "price": 36.25}]}, {"sector": "산업재 · 항공우주 · 방산", "weight": 253.42, "stocks": [{"code": "GE", "name": "GE", "fullName": "GE Aerospace", "weight": 25.62, "chg": -0.33, "price": 316.98}, {"code": "CAT", "name": "CAT", "fullName": "Caterpillar Inc.", "weight": 21.96, "chg": 0.57, "price": 543.69}, {"code": "GEV", "name": "GEV", "fullName": "GE Vernova Inc.", "weight": 18.84, "chg": -0.78, "price": 715.0}, {"code": "DE", "name": "DE", "fullName": "Deere & Company", "weight": 17.91, "chg": 4.44, "price": 641.02}, {"code": "BA", "name": "BA", "fullName": "The Boeing Company", "weight": 15.29, "chg": 0.57, "price": 164.53}, {"code": "ETN", "name": "ETN", "fullName": "Eaton Corporation plc", "weight": 14.83, "chg": -0.46, "price": 317.81}, {"code": "GD", "name": "GD", "fullName": "General Dynamics Corporation", "weight": 12.99, "chg": 2.48, "price": 360.27}, {"code": "CSX", "name": "CSX", "fullName": "CSX Corporation", "weight": 12.76, "chg": 2.16, "price": 51.16}, {"code": "EMR", "name": "EMR", "fullName": "Emerson Electric Co.", "weight": 12.14, "chg": 0.16, "price": 157.23}, {"code": "ITW", "name": "ITW", "fullName": "Illinois Tool Works Inc.", "weight": 11.72, "chg": 0.47, "price": 285.08}, {"code": "FDX", "name": "FDX", "fullName": "FedEx Corporation", "weight": 11.0, "chg": 0.19, "price": 308.87}, {"code": "HON", "name": "HON", "fullName": "Honeywell International Inc.", "weight": 10.92, "chg": 0.12, "price": 225.1}, {"code": "RTX", "name": "RTX", "fullName": "RTX", "weight": 8.43, "chg": 0.45, "price": 120.0}, {"code": "UNP", "name": "UNP", "fullName": "UNP", "weight": 8.43, "chg": 0.45, "price": 120.0}, {"code": "LMT", "name": "LMT", "fullName": "LMT", "weight": 8.43, "chg": 0.45, "price": 120.0}, {"code": "UPS", "name": "UPS", "fullName": "UPS", "weight": 8.43, "chg": 0.45, "price": 120.0}, {"code": "NOC", "name": "NOC", "fullName": "NOC", "weight": 8.43, "chg": 0.45, "price": 120.0}, {"code": "WM", "name": "WM", "fullName": "WM", "weight": 8.43, "chg": 0.45, "price": 120.0}, {"code": "PH", "name": "PH", "fullName": "PH", "weight": 8.43, "chg": 0.45, "price": 120.0}, {"code": "NSC", "name": "NSC", "fullName": "NSC", "weight": 8.43, "chg": 0.45, "price": 120.0}]}, {"sector": "에너지 · 정유 · 천연가스", "weight": 156.68, "stocks": [{"code": "CVX", "name": "CVX", "fullName": "Chevron Corporation", "weight": 29.11, "chg": 1.06, "price": 210.95}, {"code": "COP", "name": "COP", "fullName": "ConocoPhillips", "weight": 17.13, "chg": 0.28, "price": 135.02}, {"code": "EOG", "name": "EOG", "fullName": "EOG Resources, Inc.", "weight": 11.38, "chg": 1.17, "price": 148.31}, {"code": "BKR", "name": "BKR", "fullName": "Baker Hughes Company", "weight": 8.54, "chg": 1.02, "price": 46.36}, {"code": "XOM", "name": "XOM", "fullName": "XOM", "weight": 8.43, "chg": 0.45, "price": 120.0}, {"code": "WMB", "name": "WMB", "fullName": "WMB", "weight": 8.43, "chg": 0.45, "price": 120.0}, {"code": "SLB", "name": "SLB", "fullName": "SLB", "weight": 8.43, "chg": 0.45, "price": 120.0}, {"code": "ONEOK", "name": "ONEOK", "fullName": "ONEOK", "weight": 8.43, "chg": 0.45, "price": 120.0}, {"code": "KMI", "name": "KMI", "fullName": "KMI", "weight": 8.43, "chg": 0.45, "price": 120.0}, {"code": "PSX", "name": "PSX", "fullName": "PSX", "weight": 8.43, "chg": 0.45, "price": 120.0}, {"code": "MPC", "name": "MPC", "fullName": "MPC", "weight": 8.43, "chg": 0.45, "price": 120.0}, {"code": "VLO", "name": "VLO", "fullName": "VLO", "weight": 8.43, "chg": 0.45, "price": 120.0}, {"code": "OXY", "name": "OXY", "fullName": "OXY", "weight": 8.43, "chg": 0.45, "price": 120.0}, {"code": "HES", "name": "HES", "fullName": "HES", "weight": 8.43, "chg": 0.45, "price": 120.0}, {"code": "HAL", "name": "HAL", "fullName": "Halliburton Company", "weight": 6.22, "chg": 2.3, "price": 31.61}]}, {"sector": "유틸리티 · 리츠 · 소재", "weight": 178.53, "stocks": [{"code": "DUK", "name": "DUK", "fullName": "Duke Energy Corporation", "weight": 13.39, "chg": 0.72, "price": 131.9}, {"code": "EQIX", "name": "EQIX", "fullName": "Equinix, Inc.", "weight": 12.95, "chg": -0.46, "price": 978.22}, {"code": "ECL", "name": "ECL", "fullName": "Ecolab Inc.", "weight": 12.16, "chg": 0.57, "price": 308.89}, {"code": "AMT", "name": "AMT", "fullName": "American Tower Corporation", "weight": 12.08, "chg": 0.96, "price": 184.59}, {"code": "CEG", "name": "CEG", "fullName": "Constellation Energy Corporation", "weight": 11.91, "chg": -3.9, "price": 235.28}, {"code": "APD", "name": "APD", "fullName": "Air Products and Chemicals, Inc.", "weight": 10.79, "chg": 1.84, "price": 314.26}, {"code": "FCX", "name": "FCX", "fullName": "Freeport-McMoRan Inc.", "weight": 10.78, "chg": 1.72, "price": 48.55}, {"code": "DLR", "name": "DLR", "fullName": "Digital Realty Trust, Inc.", "weight": 10.17, "chg": 0.67, "price": 166.43}, {"code": "LIN", "name": "LIN", "fullName": "LIN", "weight": 8.43, "chg": 0.45, "price": 120.0}, {"code": "NEE", "name": "NEE", "fullName": "NEE", "weight": 8.43, "chg": 0.45, "price": 120.0}, {"code": "PLD", "name": "PLD", "fullName": "PLD", "weight": 8.43, "chg": 0.45, "price": 120.0}, {"code": "SHW", "name": "SHW", "fullName": "SHW", "weight": 8.43, "chg": 0.45, "price": 120.0}, {"code": "SO", "name": "SO", "fullName": "SO", "weight": 8.43, "chg": 0.45, "price": 120.0}, {"code": "WELL", "name": "WELL", "fullName": "WELL", "weight": 8.43, "chg": 0.45, "price": 120.0}, {"code": "SCCO", "name": "SCCO", "fullName": "SCCO", "weight": 8.43, "chg": 0.45, "price": 120.0}, {"code": "NEM", "name": "NEM", "fullName": "NEM", "weight": 8.43, "chg": 0.45, "price": 120.0}, {"code": "PSA", "name": "PSA", "fullName": "PSA", "weight": 8.43, "chg": 0.45, "price": 120.0}, {"code": "O", "name": "O", "fullName": "O", "weight": 8.43, "chg": 0.45, "price": 120.0}]}];

    /**
     * 국가별 거래소 현지 시각(Intl.DateTimeFormat, 서머타임 자동 반영)을 계산하여
     * 실제 개장 중일 때만 '🟢 장중 · 실시간', 마감 후에는 '⚪ 장마감' / '🟡 프리마켓'으로 정확히 표시
     */
    function getTzParts(timeZone) {
        try {
            const fmt = new Intl.DateTimeFormat('en-US', {
                timeZone,
                weekday: 'short',
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
            });
            const parts = fmt.formatToParts(new Date());
            const map = {};
            parts.forEach(p => { map[p.type] = p.value; });
            const wd = map.weekday || 'Mon'; // Sun, Mon, Tue, Wed, Thu, Fri, Sat
            const hr = parseInt(map.hour || '0', 10) % 24;
            const mi = parseInt(map.minute || '0', 10);
            const isWeekend = (wd === 'Sat' || wd === 'Sun');
            return { wd, hr, mi, mins: hr * 60 + mi, isWeekend };
        } catch (e) {
            const now = new Date();
            const hr = now.getHours();
            const mi = now.getMinutes();
            const d = now.getDay();
            return { wd: 'Mon', hr, mi, mins: hr * 60 + mi, isWeekend: (d === 0 || d === 6) };
        }
    }

    function getLiveMarketStatus(mktType, apiStatus) {
        if (apiStatus === 'OPEN') {
            return { label: '장중 · 실시간', color: '#34d399', dot: '#10b981', isOpen: true };
        }
        if (apiStatus === 'CLOSE') {
            return { label: '장마감', color: '#94a3b8', dot: '#64748b', isOpen: false };
        }

        if (mktType === 'KR') {
            const t = getTzParts('Asia/Seoul');
            if (t.isWeekend) return { label: '장마감', color: '#94a3b8', dot: '#64748b', isOpen: false };
            if (t.mins >= 540 && t.mins <= 930) { // 09:00 ~ 15:30 KST
                return { label: '장중 · 실시간', color: '#34d399', dot: '#10b981', isOpen: true };
            }
            if ((t.mins >= 480 && t.mins < 540) || (t.mins > 930 && t.mins <= 1080)) { // 08:00~09:00, 15:30~18:00
                return { label: '장마감 (시간외)', color: '#fbbf24', dot: '#f59e0b', isOpen: false };
            }
            return { label: '장마감', color: '#94a3b8', dot: '#64748b', isOpen: false };
        }

        if (mktType === 'US') {
            // 미국 동부시간(America/New_York) 기준: 서머타임(EDT)과 동절기(EST)를 브라우저가 자동 변환
            const t = getTzParts('America/New_York');
            if (t.isWeekend) return { label: '장마감', color: '#94a3b8', dot: '#64748b', isOpen: false };
            if (t.mins >= 570 && t.mins < 960) { // 09:30 ~ 16:00 ET (한국시간 밤 22:30/23:30 ~ 새벽 05:00/06:00)
                return { label: '장중 · 실시간', color: '#34d399', dot: '#10b981', isOpen: true };
            }
            if (t.mins >= 240 && t.mins < 570) { // 04:00 ~ 09:30 ET (한국시간 오후 17:00/18:00 ~ 22:30/23:30)
                return { label: '프리마켓', color: '#fbbf24', dot: '#f59e0b', isOpen: false };
            }
            if (t.mins >= 960 && t.mins < 1200) { // 16:00 ~ 20:00 ET
                return { label: '애프터마켓 · 정규장마감', color: '#94a3b8', dot: '#64748b', isOpen: false };
            }
            return { label: '장마감', color: '#94a3b8', dot: '#64748b', isOpen: false };
        }

        if (mktType === 'EU') {
            // 유럽 중부시간(Europe/Berlin) 기준: 09:00 ~ 17:35 CET/CEST (한국시간 오후 16:00/17:00 ~ 새벽 00:35/01:35)
            const t = getTzParts('Europe/Berlin');
            if (t.isWeekend) return { label: '장마감', color: '#94a3b8', dot: '#64748b', isOpen: false };
            if (t.mins >= 540 && t.mins <= 1055) {
                return { label: '장중 · 실시간', color: '#34d399', dot: '#10b981', isOpen: true };
            }
            return { label: '장마감', color: '#94a3b8', dot: '#64748b', isOpen: false };
        }

        if (mktType === 'EU_FUT') {
            // 유럽 지수 선물(Eurex): 평일 01:15 ~ 22:00 CET (한국시간 09:15 ~ 익일 06:00)
            const t = getTzParts('Europe/Berlin');
            if (t.isWeekend) return { label: '장마감', color: '#94a3b8', dot: '#64748b', isOpen: false };
            if (t.mins >= 75 && t.mins <= 1320) {
                return { label: '선물 실시간', color: '#34d399', dot: '#10b981', isOpen: true };
            }
            return { label: '장마감', color: '#94a3b8', dot: '#64748b', isOpen: false };
        }

        if (mktType === 'JP') {
            const t = getTzParts('Asia/Tokyo');
            if (t.isWeekend) return { label: '장마감', color: '#94a3b8', dot: '#64748b', isOpen: false };
            if (t.mins >= 540 && t.mins <= 930) {
                return { label: '장중 · 실시간', color: '#34d399', dot: '#10b981', isOpen: true };
            }
            return { label: '장마감', color: '#94a3b8', dot: '#64748b', isOpen: false };
        }

        if (mktType === 'TW') {
            const t = getTzParts('Asia/Seoul'); // 대만 09:00~13:30 CST = 한국 10:00~14:30 KST
            if (t.isWeekend) return { label: '장마감', color: '#94a3b8', dot: '#64748b', isOpen: false };
            if (t.mins >= 600 && t.mins <= 870) {
                return { label: '장중 · 실시간', color: '#34d399', dot: '#10b981', isOpen: true };
            }
            return { label: '장마감', color: '#94a3b8', dot: '#64748b', isOpen: false };
        }

        if (mktType === 'FX24') {
            const t = getTzParts('America/New_York');
            if (t.wd === 'Sat' || (t.wd === 'Fri' && t.mins >= 1020) || (t.wd === 'Sun' && t.mins < 1020)) {
                return { label: '주말 마감', color: '#94a3b8', dot: '#64748b', isOpen: false };
            }
            return { label: '24H 실시간', color: '#34d399', dot: '#10b981', isOpen: true };
        }

        return { label: '장마감', color: '#94a3b8', dot: '#64748b', isOpen: false };
    }

    function renderStatusBadgeHtml(mktType, apiStatus, compact = false) {
        const st = getLiveMarketStatus(mktType, apiStatus);
        const dotSize = compact ? 5 : 6;
        const fontSize = compact ? '10px' : '11px';
        return `
            <span style="display:inline-flex; align-items:center; gap:4px; font-size:${fontSize}; font-weight:700; color:${st.color}; margin-left:2px;">
                <span style="width:${dotSize}px; height:${dotSize}px; border-radius:50%; background:${st.dot}; ${st.isOpen ? 'box-shadow:0 0 6px ' + st.dot + ';' : ''}"></span>
                <span>${esc(st.label)}</span>
            </span>
        `;
    }

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

    function computePixelTreemap(items, xPx, yPx, wPx, hPx) {
        const valid = (items || []).filter(it => (Number(it.weight) || 0) > 0);
        if (valid.length === 0) return [];
        if (valid.length === 1) {
            return [{ ...valid[0], xPx, yPx, wPx, hPx }];
        }
        const total = valid.reduce((s, it) => s + Number(it.weight), 0);
        let acc = 0;
        let splitIdx = 0;
        for (let i = 0; i < valid.length - 1; i++) {
            acc += Number(valid[i].weight);
            splitIdx = i + 1;
            if (acc >= total * 0.5) break;
        }
        const leftSum = valid.slice(0, splitIdx).reduce((s, it) => s + Number(it.weight), 0);
        const ratio = total > 0 ? (leftSum / total) : 0.5;

        if (wPx >= hPx) {
            const w1 = wPx * ratio;
            return [
                ...computePixelTreemap(valid.slice(0, splitIdx), xPx, yPx, w1, hPx),
                ...computePixelTreemap(valid.slice(splitIdx), xPx + w1, yPx, wPx - w1, hPx)
            ];
        } else {
            const h1 = hPx * ratio;
            return [
                ...computePixelTreemap(valid.slice(0, splitIdx), xPx, yPx, wPx, h1),
                ...computePixelTreemap(valid.slice(splitIdx), xPx, yPx + h1, wPx, hPx - h1)
            ];
        }
    }

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
                    <div class="mh-idx-name-row" style="justify-content:space-between;">
                        <div style="display:inline-flex; align-items:center; gap:5px;">
                            <span>${item.flag}</span>
                            <span>${esc(item.name)}</span>
                        </div>
                        ${renderStatusBadgeHtml(item.mktType, item.apiStatus, false)}
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

    // 백엔드에서 받아온 28대 글로벌 실시간 지수(indices)를 INDEX_GROUPS의 모든 대형/미니 카드에 반영
    function applyLiveIndicesToGroups(idxMap) {
        if (!idxMap || typeof idxMap !== 'object') return false;
        const fmtN = (v) => Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        let changed = false;

        const patchFeatured = (item) => {
            if (!item || !item.id) return;
            const baseId = item.id.endsWith('F') && !idxMap[item.id] ? item.id.slice(0, -1) : item.id;
            const live = idxMap[item.id] || idxMap[baseId];
            if (!live || !live.price) return;
            item.price = Number(live.price);
            item.chg = Number(live.chg || 0);
            item.chgPct = Number(live.chgPct || 0);
            if (live.prev) item.prev = fmtN(live.prev);
            if (live.high) item.high = fmtN(live.high);
            if (live.low) item.low = fmtN(live.low);
            if (live.high52) item.high52 = fmtN(live.high52);
            if (live.low52) item.low52 = fmtN(live.low52);
            if (Array.isArray(live.series) && live.series.length >= 2) item.series = live.series;
            if (live.marketStatus) item.apiStatus = live.marketStatus;
            changed = true;
        };

        const patchMini = (p) => {
            if (!p || !p.id) return;
            const live = idxMap[p.id];
            if (!live || !live.price) return;
            const pref = p.prefix || '';
            const suff = p.suffix || '';
            const isUp = Number(live.chg) >= 0;
            const sym = isUp ? '▲' : '▼';
            const plus = isUp ? '+' : '';
            p.price = `${pref}${fmtN(live.price)}${suff}`;
            p.chgText = `${sym} ${fmtN(Math.abs(live.chg))}(${plus}${Number(live.chgPct).toFixed(2)}%)`;
            p.up = isUp;
            if (live.high52) p.sub = `52주 최고 ${pref}${fmtN(live.high52)}${suff}`;
            changed = true;
        };

        ['GLOBAL', 'EUROPE'].forEach(gKey => {
            const grp = INDEX_GROUPS[gKey];
            if (!grp) return;
            (grp.featured || []).forEach(patchFeatured);
            if (grp.bottomLeft) patchFeatured(grp.bottomLeft);
            (grp.pairs || []).forEach(pairArr => pairArr.forEach(patchMini));
        });
        return changed;
    }

    // 실시간 시세 동기화 (구버전 all_stocks.json이 최신 실시간 데이터를 덮어쓰지 못하도록 _liveLocked 보호)
    function syncMainHomeLivePrices(forceFetch = false) {
        // 1. window.allStocks 에도 히트맵의 최신 내장 시세를 역동기화하여 브리핑 모달과 100% 일치 보장
        if (Array.isArray(window.allStocks) && window.allStocks.length > 50) {
            const smap = new Map();
            window.allStocks.forEach(s => { if (s && s.code) smap.set(String(s.code), s); });
            KR_SECTOR_TREE.forEach(sec => {
                sec.stocks.forEach(st => {
                    const found = smap.get(st.code);
                    if (found) {
                        if (String(found.update || '').startsWith('11.18') || st._liveLocked) {
                            found.current_price = st.price;
                            found.day1 = st.chg;
                        } else if (found.current_price > 0 && found.day1 != null) {
                            st.price = found.current_price;
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

        if (homeState.liveSyncStarted && !forceFetch) return;
        homeState.liveSyncStarted = true;

        // 3. 백엔드 일괄 실시간 히트맵 & 28대 글로벌 지수 API (/api/market/heatmap-live) 호출
        fetch(`${API_BASE}/api/market/heatmap-live`)
            .then(r => r.ok ? r.json() : null)
            .then(data => {
                if (!data || !data.ok) return;
                let updated = false;
                if (data.stocks && Object.keys(data.stocks).length > 10) {
                    const rmap = data.stocks;
                    KR_SECTOR_TREE.forEach(sec => {
                        sec.stocks.forEach(st => {
                            const info = rmap[st.code];
                            if (info) {
                                if (info.price > 0) st.price = info.price;
                                if (info.chg !== null && info.chg !== undefined) {
                                    st.chg = Number(info.chg);
                                    st._liveLocked = true;
                                    updated = true;
                                }
                            }
                        });
                    });
                }
                if (data.indices && applyLiveIndicesToGroups(data.indices)) {
                    updated = true;
                }
                const box = document.getElementById('main-home-dashboard');
                if (updated && box && box.style.display !== 'none') {
                    renderMainHomeDashboard();
                }
            })
            .catch(() => {});

        // 4. 폴백: 25종목씩 분할하여 /api/stocks/realtime 병렬 호출
        const allKrCodes = [];
        KR_SECTOR_TREE.forEach(sec => sec.stocks.forEach(s => allKrCodes.push(s.code)));
        const chunks = [];
        for (let i = 0; i < allKrCodes.length; i += 25) {
            chunks.push(allKrCodes.slice(i, i + 25));
        }
        Promise.all(chunks.map(ch =>
            fetch(`${API_BASE}/api/stocks/realtime?codes=${ch.join(',')}`)
                .then(r => r.ok ? r.json() : null)
                .catch(() => null)
        )).then(results => {
            let updated = false;
            const mergedRealtime = {};
            results.forEach(res => {
                if (res && res.realtime) Object.assign(mergedRealtime, res.realtime);
            });
            if (Object.keys(mergedRealtime).length > 0) {
                KR_SECTOR_TREE.forEach(sec => {
                    sec.stocks.forEach(st => {
                        const info = mergedRealtime[st.code];
                        if (info) {
                            if (info.current_price > 0) st.price = info.current_price;
                            if (info.day1 !== null && info.day1 !== undefined) {
                                st.chg = Number(info.day1);
                                st._liveLocked = true;
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
        });

        // 5. quant_hub_cache.json 비동기 로드
        if (!homeState.quantCache) {
            const cb = Math.floor(Date.now() / 180000);
            fetch(`data/quant_hub_cache.json?t=${cb}`)
                .then(r => r.ok ? r.json() : null)
                .then(d => {
                    if (d) {
                        homeState.quantCache = d;
                        syncMainHomeLivePrices(false);
                    }
                })
                .catch(() => {});
        }

        // 6. 60초 주기로 장중 실시간 지수·히트맵 자동 갱신 타이머 가동
        if (!homeState.autoRefreshTimer) {
            homeState.autoRefreshTimer = setInterval(() => {
                const box = document.getElementById('main-home-dashboard');
                if (box && box.style.display !== 'none') {
                    syncMainHomeLivePrices(true);
                }
            }, 60000);
        }
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
                const sorted = [...themes].sort((a, b) => parseD1(b) - parseD1(a));
                const g1 = sorted.filter(t => parseD1(t) >= 3.5).slice(0, 26).map((t, i) => ({
                    code: t.name, name: t.name, weight: Math.max(10, 26 - i * 0.5), chg: parseD1(t), isTheme: true
                }));
                const g2 = sorted.filter(t => parseD1(t) >= 1.8 && parseD1(t) < 3.5).slice(0, 28).map((t, i) => ({
                    code: t.name, name: t.name, weight: Math.max(9, 22 - i * 0.4), chg: parseD1(t), isTheme: true
                }));
                const g3 = sorted.filter(t => parseD1(t) >= 0.8 && parseD1(t) < 1.8).slice(0, 28).map((t, i) => ({
                    code: t.name, name: t.name, weight: Math.max(8, 20 - i * 0.35), chg: parseD1(t), isTheme: true
                }));
                const g4 = sorted.filter(t => parseD1(t) > 0 && parseD1(t) < 0.8).slice(0, 26).map((t, i) => ({
                    code: t.name, name: t.name, weight: Math.max(8, 18 - i * 0.3), chg: parseD1(t), isTheme: true
                }));
                const g5 = [...themes].filter(t => parseD1(t) < 0).sort((a, b) => parseD1(a) - parseD1(b)).slice(0, 32).map((t, i) => ({
                    code: t.name, name: t.name, weight: Math.max(8, 22 - i * 0.35), chg: parseD1(t), isTheme: true
                }));
                const groups = [];
                if (g1.length) groups.push({ sector: `🚀 초강세 급등 주도 테마 (${g1.length}개)`, weight: sumWeights(g1), stocks: g1 });
                if (g2.length) groups.push({ sector: `🔥 강세 수급 유입 테마 (${g2.length}개)`, weight: sumWeights(g2), stocks: g2 });
                if (g3.length) groups.push({ sector: `📈 순환매 상승 테마 (${g3.length}개)`, weight: sumWeights(g3), stocks: g3 });
                if (g4.length) groups.push({ sector: `🌱 완만한 강보합 테마 (${g4.length}개)`, weight: sumWeights(g4), stocks: g4 });
                if (g5.length) groups.push({ sector: `📉 차익실현 · 조정 테마 (${g5.length}개)`, weight: sumWeights(g5), stocks: g5 });
                if (groups.length > 0) return groups;
            }
        }
        return KR_SECTOR_TREE;
    }

    function sumWeights(arr) {
        return Math.round((arr || []).reduce((s, x) => s + (Number(x.weight) || 10), 0));
    }

    function renderTreemapHtml(containerWidthPx, containerHeightPx) {
        const W_PX = Math.max(960, Number(containerWidthPx) || 1520);
        const H_PX = Math.max(760, Number(containerHeightPx) || homeState.heatmapHeight || 1280);
        const tree = buildActiveSectorTree();

        const sectorRects = computePixelTreemap(tree, 0, 0, W_PX, H_PX);

        return sectorRects.map(sec => {
            const secLeftPct = (sec.xPx / W_PX) * 100;
            const secTopPct = (sec.yPx / H_PX) * 100;
            const secWidthPct = (sec.wPx / W_PX) * 100;
            const secHeightPct = (sec.hPx / H_PX) * 100;

            const innerW = Math.max(40, sec.wPx);
            const innerH = Math.max(24, sec.hPx - 16);
            const stockRects = computePixelTreemap(sec.stocks || [], 0, 0, innerW, innerH);

            const tilesHtml = stockRects.map(st => {
                const bg = getHeatmapColor(st.chg);
                const sign = Number(st.chg) > 0 ? '+' : '';
                const chgStr = `${sign}${Number(st.chg).toFixed(2)}%`;

                const stLeftPct = (st.xPx / innerW) * 100;
                const stTopPct = (st.yPx / innerH) * 100;
                const stWidthPct = (st.wPx / innerW) * 100;
                const stHeightPct = (st.hPx / innerH) * 100;

                const minDim = Math.min(st.wPx, st.hPx);
                const tileArea = st.wPx * st.hPx;
                let nameSize = 11;
                let chgSize = 10;
                let showName = true;
                let showChg = true;

                if (minDim >= 115 && tileArea >= 18000) { nameSize = 19; chgSize = 14.5; }
                else if (minDim >= 80 && tileArea >= 8500) { nameSize = 15; chgSize = 12.5; }
                else if (minDim >= 56 && tileArea >= 4200) { nameSize = 12.5; chgSize = 10.5; }
                else if (minDim >= 38 && tileArea >= 2000) { nameSize = 11; chgSize = 9.5; }
                else if (st.wPx >= 42 && st.hPx >= 26) { nameSize = 9.8; chgSize = 8.6; }
                else if (st.wPx >= 32 && st.hPx >= 15) { nameSize = 9; showChg = false; }
                else { showName = false; showChg = false; }

                const pxInfo = st.isTheme ? '' : (homeState.heatmapTab === 'US' ? ` · $${st.price}` : ` · ${Number(st.price || 0).toLocaleString()}원`);
                const fullLabel = st.fullName ? `${st.fullName} (${st.name})` : st.name;
                const tip = `[${sec.sector}] ${fullLabel} · ${chgStr}${pxInfo}`;

                return `
                    <div class="mh-tm-tile"
                         data-tm-code="${esc(st.code)}"
                         data-tm-name="${esc(st.fullName || st.name)}"
                         data-tm-theme="${st.isTheme ? '1' : '0'}"
                         title="${esc(tip)}"
                         style="left:${stLeftPct.toFixed(2)}%; top:${stTopPct.toFixed(2)}%; width:${stWidthPct.toFixed(2)}%; height:${stHeightPct.toFixed(2)}%; background:${bg};">
                        ${showName ? `<span class="tm-name" style="font-size:${nameSize}px;">${esc(st.name)}</span>` : ''}
                        ${showChg ? `<span class="tm-chg" style="font-size:${chgSize}px;">${chgStr}</span>` : ''}
                    </div>
                `;
            }).join('');

            return `
                <div class="mh-tm-sector" style="left:${secLeftPct.toFixed(2)}%; top:${secTopPct.toFixed(2)}%; width:${secWidthPct.toFixed(2)}%; height:${secHeightPct.toFixed(2)}%;">
                    <div class="mh-tm-sector-label">${esc(sec.sector)}</div>
                    <div class="mh-tm-sector-body">${tilesHtml}</div>
                </div>
            `;
        }).join('');
    }

    function renderMainHomeDashboard() {
        const box = document.getElementById('main-home-dashboard');
        if (!box) return;

        syncMainHomeLivePrices(false);

        const grp = INDEX_GROUPS[homeState.indexRegion] || INDEX_GROUPS.GLOBAL;
        const activeTree = buildActiveSectorTree();
        const totalTilesCount = activeTree.reduce((s, sec) => s + (sec.stocks ? sec.stocks.length : 0), 0);
        const estWidth = Math.max(1050, (box.clientWidth || window.innerWidth - 310) - 44);
        const hmHeight = homeState.heatmapHeight || 1280;

        box.innerHTML = `
            <!-- [1단] 당일 실시간 국내·글로벌 주요 증시 상황판 (참고 이미지 2 스타일) -->
            <div class="mh-section-block">
                <div class="mh-sec-header">
                    <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
                        <h2 class="mh-sec-title">
                            <i class="ph-fill ph-chart-line-up" style="color:#38bdf8;"></i>
                            <span>실시간 글로벌 · 국내 주요 증시 상황판</span>
                        </h2>
                        <span style="font-size:11.5px; color:#94a3b8;">한국(KST) · 미국(ET) · 유럽(CET) 현지 거래소 개장 시간 자동 연동</span>
                    </div>
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
                                        <div style="display:flex; justify-content:space-between; align-items:center; gap:4px;">
                                            <span style="font-size:11.5px; font-weight:800; color:#e2e8f0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                                                ${p.flag} ${esc(p.name)}
                                            </span>
                                            ${renderStatusBadgeHtml(p.mktType, p.apiStatus, true)}
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

            <!-- [2단] 당일 실시간 업종별 시가총액 히트맵 (참고 이미지 1 스타일 · 마우스 스크롤 대형 화면) -->
            <div class="mh-section-block">
                <div class="mh-sec-header">
                    <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
                        <h2 class="mh-sec-title">
                            <i class="ph-fill ph-squares-four" style="color:#f43f5e;"></i>
                            <span>당일 실시간 업종별 시가총액 히트맵 (총 ${totalTilesCount}개 ${homeState.heatmapTab === 'THEME' ? '테마' : '종목'})</span>
                        </h2>
                        <span style="font-size:12px; color:#94a3b8;">박스를 클릭하면 상세 차트·수급 브리핑이 즉시 열립니다 · 마우스 휠로 아래까지 스크롤하여 확인하세요</span>
                    </div>

                    <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
                        <div class="mh-legend-bar">
                            <span class="mh-legend-chip" style="background:#1565c0;">-3%↓</span>
                            <span class="mh-legend-chip" style="background:#1d4c91;">-1%</span>
                            <span class="mh-legend-chip" style="background:#2c3242;">0%</span>
                            <span class="mh-legend-chip" style="background:#bd292a;">+1%</span>
                            <span class="mh-legend-chip" style="background:#e92928;">+3%↑</span>
                        </div>

                        <div class="al-pill-group" title="히트맵 세로 높이 조절">
                            <button type="button" class="al-pill-btn ${hmHeight === 920 ? 'active' : ''}" data-mh-hm-height="920" style="padding:4px 9px; font-size:11.5px;">한눈에 (920px)</button>
                            <button type="button" class="al-pill-btn ${hmHeight === 1280 ? 'active' : ''}" data-mh-hm-height="1280" style="padding:4px 9px; font-size:11.5px;">대형 (1,280px)</button>
                            <button type="button" class="al-pill-btn ${hmHeight === 1680 ? 'active' : ''}" data-mh-hm-height="1680" style="padding:4px 9px; font-size:11.5px;">초대형 (1,680px)</button>
                        </div>

                        <div class="al-pill-group">
                            <button type="button" class="al-pill-btn ${homeState.heatmapTab === 'KR' ? 'active' : ''}" data-mh-hm-tab="KR">
                                🇰🇷 국장 업종별 (218종목)
                            </button>
                            <button type="button" class="al-pill-btn ${homeState.heatmapTab === 'US' ? 'active' : ''}" data-mh-hm-tab="US">
                                🇺🇸 미장 섹터별 (198종목)
                            </button>
                            <button type="button" class="al-pill-btn ${homeState.heatmapTab === 'THEME' ? 'active' : ''}" data-mh-hm-tab="THEME">
                                🔥 주도 테마별 (140+테마)
                            </button>
                        </div>
                    </div>
                </div>

                <div class="mh-treemap-viewport" id="mh-treemap-viewport" style="height:${hmHeight}px;">
                    ${renderTreemapHtml(estWidth, hmHeight)}
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

        box.querySelectorAll('[data-mh-hm-height]').forEach(btn => {
            btn.addEventListener('click', () => {
                homeState.heatmapHeight = Number(btn.getAttribute('data-mh-hm-height')) || 1280;
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

                if (/^\d{6}$/.test(code) && typeof window.openStockBriefingModal === 'function') {
                    let found = (window.allStocks || []).find(s => s && s.code === code);
                    let hmStock = null;
                    KR_SECTOR_TREE.forEach(sec => {
                        sec.stocks.forEach(st => { if (st.code === code) hmStock = st; });
                    });
                    if (found || hmStock) {
                        const mergedStock = {
                            ...(found || { code, name }),
                            code,
                            name: (found && found.name) || name,
                            current_price: (hmStock && hmStock.price) || (found && found.current_price) || 0,
                            day1: (hmStock && hmStock.chg != null) ? hmStock.chg : (found ? found.day1 : 0)
                        };
                        window.openStockBriefingModal(mergedStock);
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

        trackVisitorActivity('홈페이지 메인 진입', true);

        document.querySelectorAll('.menu-section li').forEach(li => {
            li.addEventListener('click', () => {
                const act = li.getAttribute('data-action') || '';
                if (!act.startsWith('community-')) {
                    window.CommunityHub.hide();
                    trackVisitorActivity(li.textContent.trim().slice(0, 24));
                }
            });
        });

        try {
            const params = new URLSearchParams(window.location.search);
            if (params.get('view') === 'community') {
                window.CommunityHub.navigate(params.get('tab') || 'community-vault');
            }
        } catch (e) {}
    });
})();
