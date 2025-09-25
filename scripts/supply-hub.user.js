// ==UserScript==
// @name         Supply Hub
// @namespace    http://tampermonkey.net/
// @version      3.3.0
// @description  HotelRunner destek ekibi için merkezi araçlar paneli
// @author       HotelRunner Destek Ekibi
// @match        *://*.hotelrunner.com/*
// @updateURL    https://devbandi35.github.io/hotelrunner-scripts/scripts/supply-hub.user.js
// @downloadURL  https://devbandi35.github.io/hotelrunner-scripts/scripts/supply-hub.user.js
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// ==/UserScript==

// ⚠️ ÖNEMLİ: Yukarıdaki KULLANICI-ADI kısmını kendi GitHub kullanıcı adınızla değiştirin!

(function() {
    'use strict';

    // ===== MODÜL SİSTEMİ =====
    class SupplyModule {
        constructor(config) {
            this.id = config.id;
            this.name = config.name;
            this.description = config.description;
            this.category = config.category;
            this.matchUrls = config.matchUrls || [];
            this.tools = config.tools || [];
            this.isActive = false;
        }

        canRunOnCurrentPage() {
            return true; // Tüm HotelRunner sayfalarında çalışır
        }

        render() {
            const container = document.createElement('div');
            container.className = 'supply-module-container';
            
            const toolsHtml = this.tools.map(tool => `
                <button class="supply-tool-button" data-module="${this.id}" data-tool="${tool.id}">
                    ${tool.name}
                </button>
            `).join('');

            container.innerHTML = `
                <div class="module-header">
                    <p style="margin: 0 0 10px 0; color: #666; font-size: 13px;">
                        ${this.description}
                    </p>
                </div>
                <div class="tools-container">
                    ${toolsHtml}
                </div>
            `;

            return container;
        }
    }

    // ===== SUPPLY HUB ANA SINIF =====
    class SupplyHub {
        constructor() {
            this.modules = new Map();
            this.currentCategory = null;
            this.widget = null;
            this.isMinimized = false;
        }

        registerModule(module) {
            this.modules.set(module.id, module);
            console.log(`Supply Hub: ${module.name} modülü kaydedildi`);
        }

        initialize() {
            this.loadState();
            this.createStyles();
            this.createWidget();
            this.attachEventListeners();
            this.renderModules();
        }

        createStyles() {
            if (document.getElementById('supply-hub-styles')) return;
            
            const style = document.createElement('style');
            style.id = 'supply-hub-styles';
            style.textContent = `
                :root {
                    --sh-primary: #0ea5e9;
                    --sh-primary-dark: #0284c7;
                    --sh-bg: #ffffff;
                    --sh-border: #e5e5e5;
                    --sh-text: #333;
                    --sh-text-muted: #666;
                }

                #supply-hub-widget {
                    position: fixed;
                    width: min(380px, 90vw);
                    background: var(--sh-bg);
                    border-radius: 12px;
                    box-shadow: 0 8px 24px rgba(0,0,0,0.15);
                    z-index: 10000;
                    font-family: 'Inter', 'Segoe UI', Arial, sans-serif;
                    font-size: 14px;
                    color: var(--sh-text);
                    transition: opacity 0.3s ease, transform 0.3s ease;
                    display: block;
                    opacity: 0;
                    transform: scale(0.95);
                }

                #supply-hub-widget.visible {
                    opacity: 1;
                    transform: scale(1);
                }

                #supply-hub-widget.minimized {
                    display: none !important;
                }

                .hub-header {
                    background: linear-gradient(135deg, var(--sh-primary) 0%, var(--sh-primary-dark) 100%);
                    color: white;
                    padding: 16px 20px;
                    border-radius: 12px 12px 0 0;
                    cursor: move;
                    user-select: none;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }

                .hub-title {
                    margin: 0;
                    font-size: 18px;
                    font-weight: 700;
                }

                .hub-controls {
                    display: flex;
                    gap: 8px;
                }

                .hub-control-btn {
                    background: rgba(255,255,255,0.2);
                    border: none;
                    color: white;
                    width: 28px;
                    height: 28px;
                    border-radius: 6px;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 16px;
                    transition: background 0.2s;
                }

                .hub-control-btn:hover {
                    background: rgba(255,255,255,0.3);
                }

                .hub-categories {
                    background: #f8f9fa;
                    border-bottom: 1px solid var(--sh-border);
                    display: flex;
                    overflow-x: auto;
                }

                .category-tab {
                    padding: 12px 16px;
                    background: none;
                    border: none;
                    border-bottom: 3px solid transparent;
                    cursor: pointer;
                    font-weight: 600;
                    color: var(--sh-text-muted);
                    white-space: nowrap;
                    transition: all 0.2s;
                    min-width: fit-content;
                }

                .category-tab:hover {
                    background: #e9ecef;
                    color: var(--sh-text);
                }

                .category-tab.active {
                    color: var(--sh-primary);
                    border-bottom-color: var(--sh-primary);
                    background: white;
                }

                .hub-content {
                    padding: 20px;
                    max-height: 400px;
                    overflow-y: auto;
                }

                .module-section {
                    display: none;
                    margin-bottom: 20px;
                }

                .module-section.active {
                    display: block;
                }

                .supply-module-container {
                    margin-bottom: 16px;
                    padding: 16px;
                    background: #f8f9fa;
                    border-radius: 8px;
                    border: 1px solid #e9ecef;
                }

                .tools-container {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }

                .supply-tool-button {
                    padding: 10px 16px;
                    background: white;
                    border: 1px solid var(--sh-primary);
                    color: var(--sh-primary);
                    border-radius: 6px;
                    cursor: pointer;
                    font-weight: 600;
                    transition: all 0.2s;
                    text-align: center;
                }

                .supply-tool-button:hover {
                    background: var(--sh-primary);
                    color: white;
                }

                .supply-tool-button:active {
                    transform: scale(0.98);
                }

                #supply-hub-icon {
                    position: fixed;
                    bottom: 20px;
                    left: 20px;
                    width: 56px;
                    height: 56px;
                    background: var(--sh-primary);
                    color: white;
                    border: none;
                    border-radius: 50%;
                    cursor: pointer;
                    display: none;
                    align-items: center;
                    justify-content: center;
                    font-size: 18px;
                    font-weight: 700;
                    box-shadow: 0 4px 12px rgba(14, 165, 233, 0.4);
                    z-index: 9999;
                    transition: all 0.2s;
                }

                #supply-hub-icon:hover {
                    transform: scale(1.1);
                    box-shadow: 0 6px 16px rgba(14, 165, 233, 0.5);
                }

                #supply-hub-icon.visible {
                    display: flex;
                }

                .hub-status {
                    padding: 8px 20px;
                    background: #f8f9fa;
                    border-top: 1px solid var(--sh-border);
                    font-size: 12px;
                    color: var(--sh-text-muted);
                    border-radius: 0 0 12px 12px;
                }
            `;
            document.head.appendChild(style);
        }

        createWidget() {
            this.widget = document.createElement('div');
            this.widget.id = 'supply-hub-widget';
            this.widget.style.left = '20px';
            this.widget.style.top = '20px';
            
            this.widget.innerHTML = `
                <div class="hub-header">
                    <h2 class="hub-title">Supply Hub</h2>
                    <div class="hub-controls">
                        <button class="hub-control-btn" id="hub-minimize" title="Küçült">−</button>
                    </div>
                </div>
                <div class="hub-categories" id="hub-categories">
                    <!-- Kategoriler buraya eklenecek -->
                </div>
                <div class="hub-content" id="hub-content">
                    <!-- Modül içerikleri buraya eklenecek -->
                </div>
                <div class="hub-status">
                    <span id="hub-status-text">Hazır • GitHub v3.3.0</span>
                </div>
            `;

            document.body.appendChild(this.widget);

            this.minimizeIcon = document.createElement('button');
            this.minimizeIcon.id = 'supply-hub-icon';
            this.minimizeIcon.innerHTML = 'SH';
            this.minimizeIcon.title = 'Supply Hub\'ı Aç';
            document.body.appendChild(this.minimizeIcon);

            setTimeout(() => {
                this.widget.classList.add('visible');
            }, 100);

            if (this.isMinimized) {
                setTimeout(() => {
                    this.minimizeWidget();
                }, 150);
            }
        }

        attachEventListeners() {
            document.getElementById('hub-minimize').addEventListener('click', () => this.minimizeWidget());
            this.minimizeIcon.addEventListener('click', () => this.restoreWidget());

            this.setupDragFunctionality();

            document.addEventListener('click', (e) => {
                if (e.target.classList.contains('supply-tool-button')) {
                    const moduleId = e.target.dataset.module;
                    const toolId = e.target.dataset.tool;
                    this.executeTool(moduleId, toolId);
                }
            });

            document.addEventListener('click', (e) => {
                if (e.target.classList.contains('category-tab')) {
                    this.switchCategory(e.target.dataset.category);
                }
            });
        }

        setupDragFunctionality() {
            let isDragging = false;
            let startX, startY, startLeft, startTop;

            const header = this.widget.querySelector('.hub-header');
            
            header.addEventListener('mousedown', (e) => {
                if (e.target.classList.contains('hub-control-btn')) return;
                
                isDragging = true;
                startX = e.clientX;
                startY = e.clientY;
                startLeft = this.widget.offsetLeft;
                startTop = this.widget.offsetTop;
                
                this.widget.style.transition = 'none';
                header.style.cursor = 'grabbing';
                document.body.style.userSelect = 'none';
                
                header.setPointerCapture?.(e.pointerId);
                e.preventDefault();
            });

            document.addEventListener('mousemove', (e) => {
                if (!isDragging) return;

                const newLeft = startLeft + (e.clientX - startX);
                const newTop = startTop + (e.clientY - startY);

                const maxLeft = window.innerWidth - this.widget.offsetWidth;
                const maxTop = window.innerHeight - this.widget.offsetHeight;

                const clampedLeft = Math.max(0, Math.min(newLeft, maxLeft));
                const clampedTop = Math.max(0, Math.min(newTop, maxTop));

                this.widget.style.left = clampedLeft + 'px';
                this.widget.style.top = clampedTop + 'px';
            });

            document.addEventListener('mouseup', (e) => {
                if (isDragging) {
                    isDragging = false;
                    
                    this.widget.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
                    header.style.cursor = 'move';
                    document.body.style.userSelect = '';
                    
                    header.releasePointerCapture?.(e.pointerId);
                    
                    this.saveState();
                }
            });
        }

        renderModules() {
            const categoriesContainer = document.getElementById('hub-categories');
            const contentContainer = document.getElementById('hub-content');
            
            const categories = {};
            this.modules.forEach(module => {
                if (!categories[module.category]) {
                    categories[module.category] = [];
                }
                categories[module.category].push(module);
            });

            categoriesContainer.innerHTML = '';
            const categoryKeys = Object.keys(categories);
            
            categoryKeys.forEach((category, index) => {
                const tab = document.createElement('button');
                tab.className = 'category-tab';
                tab.dataset.category = category;
                tab.textContent = category;
                if (index === 0) {
                    tab.classList.add('active');
                    this.currentCategory = category;
                }
                categoriesContainer.appendChild(tab);
            });

            contentContainer.innerHTML = '';
            Object.entries(categories).forEach(([category, modules]) => {
                const section = document.createElement('div');
                section.className = 'module-section';
                section.dataset.category = category;
                if (category === this.currentCategory) {
                    section.classList.add('active');
                }

                modules.forEach(module => {
                    const moduleElement = module.render();
                    section.appendChild(moduleElement);
                });

                contentContainer.appendChild(section);
            });

            document.getElementById('hub-status-text').textContent = 
                `${this.modules.size} modül yüklendi • GitHub v3.3.0`;
        }

        switchCategory(category) {
            document.querySelectorAll('.category-tab').forEach(tab => {
                tab.classList.toggle('active', tab.dataset.category === category);
            });

            document.querySelectorAll('.module-section').forEach(section => {
                section.classList.toggle('active', section.dataset.category === category);
            });

            this.currentCategory = category;
        }

        executeTool(moduleId, toolId) {
            const module = this.modules.get(moduleId);
            if (!module) return;

            const tool = module.tools.find(t => t.id === toolId);
            if (!tool) return;

            try {
                document.getElementById('hub-status-text').textContent = `${tool.name} çalışıyor...`;
                
                if (typeof tool.action === 'function') {
                    tool.action();
                } else if (typeof tool.action === 'string') {
                    eval(tool.action);
                }
                
                document.getElementById('hub-status-text').textContent = `${tool.name} tamamlandı`;
                
                setTimeout(() => {
                    document.getElementById('hub-status-text').textContent = `Hazır • GitHub v3.3.0`;
                }, 3000);
                
            } catch (error) {
                console.error('Tool execution error:', error);
                document.getElementById('hub-status-text').textContent = `Hata: ${tool.name}`;
                alert(`${tool.name} çalıştırılırken bir hata oluştu: ${error.message}`);
            }
        }

        minimizeWidget() {
            this.widget.classList.add('minimized');
            this.minimizeIcon.classList.add('visible');
            this.isMinimized = true;
            this.saveState();
        }

        restoreWidget() {
            this.widget.classList.remove('minimized');
            this.minimizeIcon.classList.remove('visible');
            this.isMinimized = false;
            this.saveState();
        }

        saveState() {
            const state = {
                position: {
                    left: this.widget.style.left,
                    top: this.widget.style.top
                },
                isMinimized: this.isMinimized,
                currentCategory: this.currentCategory
            };
            
            try {
                localStorage.setItem('supply-hub-state', JSON.stringify(state));
            } catch (e) {
                console.error('State save error:', e);
            }
        }

        loadState() {
            try {
                const state = JSON.parse(localStorage.getItem('supply-hub-state') || '{}');
                
                if (state.position) {
                    // Position restore widget oluşturulduktan sonra yapılacak
                }
                
                this.isMinimized = state.isMinimized || false;
                this.currentCategory = state.currentCategory;
            } catch (e) {
                console.error('State load error:', e);
            }
        }
    }

    // ===== ÖRNEK MODÜL =====
    const DemoModule = new SupplyModule({
        id: 'demo',
        name: 'Demo Tools',
        description: 'GitHub entegrasyonu test modülü',
        category: 'Test',
        tools: [
            {
                id: 'hello',
                name: 'Merhaba De',
                action: function() {
                    alert('Merhaba! Supply Hub GitHub\'dan çalışıyor! 🎉');
                }
            },
            {
                id: 'page-info',
                name: 'Sayfa Bilgisi',
                action: function() {
                    alert(`Sayfa: ${window.location.href}\nTarih: ${new Date().toLocaleString('tr-TR')}`);
                }
            }
        ]
    });

    // ===== ANA BAŞLATMA =====
    function initializeSupplyHub() {
        const hub = new SupplyHub();
        
        hub.registerModule(DemoModule);
        
        hub.initialize();
        
        console.log('Supply Hub GitHub versiyonu başlatıldı! 🚀');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeSupplyHub);
    } else {
        initializeSupplyHub();
    }

})();
