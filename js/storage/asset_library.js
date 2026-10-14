// Sidehop Asset Library & Sticker Book Storage Engine

const ASSET_STORAGE_KEY = 'sidehop_asset_library_v1';

export class AssetLibrary {
  static getAssets() {
    try {
      const raw = localStorage.getItem(ASSET_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Failed to load asset library from localStorage:', e);
    }
    const defaults = this.getDefaultAssets();
    this.saveAll(defaults);
    return defaults;
  }

  static saveAll(assets) {
    try {
      localStorage.setItem(ASSET_STORAGE_KEY, JSON.stringify(assets));
    } catch (e) {
      console.warn('Failed to save assets to localStorage:', e);
    }
  }

  static saveAsset(name, dataUrl, category = 'custom') {
    const assets = this.getAssets();
    const newAsset = {
      id: 'asset_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      name: name || 'Custom Sticker',
      dataUrl,
      category,
      isDefault: false,
      createdAt: new Date().toISOString()
    };
    assets.unshift(newAsset);
    this.saveAll(assets);
    return newAsset;
  }

  static deleteAsset(id) {
    let assets = this.getAssets();
    assets = assets.filter(a => a.id !== id);
    this.saveAll(assets);
    return assets;
  }

  // Pre-bundled high quality Kid Pix / Neo-brutalist starter stickers
  static getDefaultAssets() {
    return [
      {
        id: 'default_star',
        name: '⭐ Neon Star',
        category: 'stickers',
        isDefault: true,
        dataUrl: this.createSvgDataUrl(`
          <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
            <polygon points="32,4 40,24 62,24 44,38 51,60 32,46 13,60 20,38 2,24 24,24" fill="#FFE600" stroke="#121212" stroke-width="4" stroke-linejoin="round"/>
            <polygon points="32,10 37,24 50,24 39,33 43,46 32,38 21,46 25,33 14,24 27,24" fill="#FFF9A6"/>
            <circle cx="27" cy="27" r="3" fill="#121212"/>
            <circle cx="37" cy="27" r="3" fill="#121212"/>
            <path d="M29,33 Q32,37 35,33" fill="none" stroke="#121212" stroke-width="2.5" stroke-linecap="round"/>
          </svg>
        `)
      },
      {
        id: 'default_shroom',
        name: '🍄 Power Shroom',
        category: 'stickers',
        isDefault: true,
        dataUrl: this.createSvgDataUrl(`
          <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
            <path d="M12,38 C10,18 54,18 52,38 Z" fill="#FF3388" stroke="#121212" stroke-width="4" stroke-linejoin="round"/>
            <circle cx="22" cy="28" r="5" fill="#FFFFFF" stroke="#121212" stroke-width="2"/>
            <circle cx="42" cy="28" r="5" fill="#FFFFFF" stroke="#121212" stroke-width="2"/>
            <circle cx="32" cy="20" r="4" fill="#FFFFFF" stroke="#121212" stroke-width="2"/>
            <rect x="22" y="38" width="20" height="18" rx="6" fill="#FFF9E6" stroke="#121212" stroke-width="4"/>
            <circle cx="28" cy="45" r="2.5" fill="#121212"/>
            <circle cx="36" cy="45" r="2.5" fill="#121212"/>
          </svg>
        `)
      },
      {
        id: 'default_gem',
        name: '💎 Cyan Crystal',
        category: 'stickers',
        isDefault: true,
        dataUrl: this.createSvgDataUrl(`
          <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
            <polygon points="18,12 46,12 58,26 32,56 6,26" fill="#00E5FF" stroke="#121212" stroke-width="4" stroke-linejoin="round"/>
            <polygon points="18,12 32,26 6,26" fill="#80F2FF" stroke="#121212" stroke-width="2"/>
            <polygon points="46,12 32,26 58,26" fill="#00B8D4" stroke="#121212" stroke-width="2"/>
            <polygon points="18,12 46,12 32,26" fill="#E0FBFF" stroke="#121212" stroke-width="2"/>
            <polygon points="6,26 32,26 32,56" fill="#00C4D8" stroke="#121212" stroke-width="2"/>
            <polygon points="58,26 32,26 32,56" fill="#009FB5" stroke="#121212" stroke-width="2"/>
          </svg>
        `)
      },
      {
        id: 'default_alien',
        name: '👾 Space Invader',
        category: 'stickers',
        isDefault: true,
        dataUrl: this.createSvgDataUrl(`
          <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
            <rect x="10" y="14" width="44" height="36" rx="10" fill="#00E676" stroke="#121212" stroke-width="4"/>
            <circle cx="24" cy="28" r="6" fill="#FFFFFF" stroke="#121212" stroke-width="2.5"/>
            <circle cx="40" cy="28" r="6" fill="#FFFFFF" stroke="#121212" stroke-width="2.5"/>
            <circle cx="25" cy="28" r="3" fill="#121212"/>
            <circle cx="39" cy="28" r="3" fill="#121212"/>
            <rect x="22" y="38" width="20" height="4" rx="2" fill="#121212"/>
            <line x1="20" y1="14" x2="16" y2="6" stroke="#121212" stroke-width="4" stroke-linecap="round"/>
            <circle cx="16" cy="6" r="3" fill="#FFE600" stroke="#121212" stroke-width="2"/>
            <line x1="44" y1="14" x2="48" y2="6" stroke="#121212" stroke-width="4" stroke-linecap="round"/>
            <circle cx="48" cy="6" r="3" fill="#FFE600" stroke="#121212" stroke-width="2"/>
          </svg>
        `)
      },
      {
        id: 'default_pizza',
        name: '🍕 Pixel Slice',
        category: 'stickers',
        isDefault: true,
        dataUrl: this.createSvgDataUrl(`
          <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
            <polygon points="12,14 52,14 32,56" fill="#FFD54F" stroke="#121212" stroke-width="4" stroke-linejoin="round"/>
            <path d="M12,14 Q32,8 52,14" fill="none" stroke="#D87A24" stroke-width="8" stroke-linecap="round"/>
            <path d="M12,14 Q32,8 52,14" fill="none" stroke="#121212" stroke-width="4" stroke-linecap="round"/>
            <circle cx="30" cy="28" r="4.5" fill="#FF3B30" stroke="#121212" stroke-width="2"/>
            <circle cx="38" cy="38" r="4" fill="#FF3B30" stroke="#121212" stroke-width="2"/>
            <circle cx="26" cy="42" r="3.5" fill="#FF3B30" stroke="#121212" stroke-width="2"/>
          </svg>
        `)
      },
      {
        id: 'default_cat',
        name: '🐱 8-Bit Kitty',
        category: 'stickers',
        isDefault: true,
        dataUrl: this.createSvgDataUrl(`
          <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
            <polygon points="12,24 16,8 28,18 36,18 48,8 52,24" fill="#FFB74D" stroke="#121212" stroke-width="4" stroke-linejoin="round"/>
            <rect x="12" y="18" width="40" height="34" rx="8" fill="#FFA726" stroke="#121212" stroke-width="4"/>
            <circle cx="24" cy="30" r="4" fill="#121212"/>
            <circle cx="40" cy="30" r="4" fill="#121212"/>
            <circle cx="23" cy="29" r="1.5" fill="#FFFFFF"/>
            <circle cx="39" cy="29" r="1.5" fill="#FFFFFF"/>
            <polygon points="32,36 30,38 34,38" fill="#FF3388"/>
            <path d="M30,38 Q32,41 34,38" fill="none" stroke="#121212" stroke-width="2"/>
            <line x1="8" y1="32" x2="18" y2="34" stroke="#121212" stroke-width="2.5" stroke-linecap="round"/>
            <line x1="8" y1="38" x2="18" y2="38" stroke="#121212" stroke-width="2.5" stroke-linecap="round"/>
            <line x1="56" y1="32" x2="46" y2="34" stroke="#121212" stroke-width="2.5" stroke-linecap="round"/>
            <line x1="56" y1="38" x2="46" y2="38" stroke="#121212" stroke-width="2.5" stroke-linecap="round"/>
          </svg>
        `)
      }
    ];
  }

  static createSvgDataUrl(svgString) {
    const cleaned = svgString.trim().replace(/\s+/g, ' ');
    return 'data:image/svg+xml;utf8,' + encodeURIComponent(cleaned);
  }
}
