// Sidehop Personal Asset Library Engine
// Manages personal custom visuals, skins, and stamps with .sidehop export/import

import { SidehopFile } from './sidehop-format.js?v=20261028_205041';

const STORAGE_KEY = 'sidehop_personal_assets_v1';

export class PersonalAssetLibrary {
  static getStorageKey() {
    return STORAGE_KEY;
  }

  // Load all saved personal assets from localStorage
  static getAll() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const list = JSON.parse(raw);
        if (Array.isArray(list) && list.length > 0) {
          return list;
        }
      }
    } catch (e) {
      console.warn('Failed to read personal assets from localStorage:', e);
    }
    // Return default starter pack if empty
    const defaults = this.getDefaultAssets();
    this.saveAll(defaults);
    return defaults;
  }

  // Save full asset list
  static saveAll(list) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch (e) {
      console.warn('Failed to save personal assets to localStorage:', e);
    }
  }

  // Get assets filtered by category
  static getByCategory(category) {
    const all = this.getAll();
    if (!category || category === 'all') return all;
    return all.filter(a => a.category === category || a.targetType === category);
  }

  // Get single asset by id
  static getById(id) {
    const all = this.getAll();
    return all.find(a => a.id === id) || null;
  }

  // Add or update an asset
  static save(assetData) {
    const all = this.getAll();
    const id = assetData.id || ('asset_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6));
    const now = new Date().toISOString();

    const asset = {
      id: id,
      name: assetData.name || 'Custom Asset',
      category: assetData.category || 'sprite',
      targetType: assetData.targetType || 'all',
      dataUrl: assetData.dataUrl,
      preview: assetData.preview || assetData.dataUrl,
      width: assetData.width || 220,
      height: assetData.height || 220,
      createdAt: assetData.createdAt || now,
      updatedAt: now,
      properties: assetData.properties || {}
    };

    const existingIndex = all.findIndex(a => a.id === id);
    if (existingIndex !== -1) {
      all[existingIndex] = asset;
    } else {
      all.unshift(asset); // add to top
    }

    this.saveAll(all);
    return asset;
  }

  // Delete single asset
  static delete(id) {
    let all = this.getAll();
    all = all.filter(a => a.id !== id);
    this.saveAll(all);
    return all;
  }

  // Export single asset as .sidehop file
  static exportAsset(id) {
    const asset = this.getById(id);
    if (!asset) throw new Error('Asset not found');

    const pkg = SidehopFile.createAssetPackage(asset, {
      title: asset.name,
      description: `Personal asset (${asset.category}) exported from Sidehop`
    });

    const slug = (asset.name || 'sidehop-asset')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    SidehopFile.download(`${slug}.sidehop`, pkg);
    return pkg;
  }

  // Export all personal assets as a .sidehop bundle file
  static exportAll() {
    const all = this.getAll();
    const pkg = SidehopFile.createBundlePackage(null, all, {
      title: 'My Sidehop Personal Asset Stash',
      description: `Exported collection of ${all.length} personal assets from Sidehop`
    });

    SidehopFile.download(`sidehop-asset-stash-${Date.now()}.sidehop`, pkg);
    return pkg;
  }

  // Import asset(s) from a parsed .sidehop package
  static importPackage(parsedPkg) {
    if (!parsedPkg || !parsedPkg.valid) {
      throw new Error('Invalid package');
    }

    if (parsedPkg.kind === 'asset' && parsedPkg.asset) {
      return this.save(parsedPkg.asset);
    }

    if (parsedPkg.kind === 'bundle' && Array.isArray(parsedPkg.assets)) {
      const saved = [];
      parsedPkg.assets.forEach(a => {
        if (a && (a.dataUrl || a.customVisual || a.data)) {
          saved.push(this.save(a));
        }
      });
      return saved;
    }

    throw new Error('Package does not contain personal asset data');
  }

  // Built-in starter personal assets (Neo-Brutalist SVGs converted to data URLs)
  static getDefaultAssets() {
    // Helper to generate clean SVG data URLs
    const makeSvgDataUrl = (svgContent) => {
      return 'data:image/svg+xml;utf8,' + encodeURIComponent(svgContent.trim());
    };

    return [
      {
        id: 'preset_golden_bunny',
        name: 'Golden Hero Bunny',
        category: 'player',
        targetType: 'player',
        createdAt: '2026-10-18T12:00:00Z',
        dataUrl: makeSvgDataUrl(`
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 120" width="100" height="120">
            <!-- Neo-Brutalist Golden Bunny -->
            <rect x="25" y="8" width="16" height="42" rx="8" fill="#FFE600" stroke="#121212" stroke-width="4"/>
            <rect x="59" y="8" width="16" height="42" rx="8" fill="#FFE600" stroke="#121212" stroke-width="4"/>
            <rect x="29" y="16" width="8" height="24" rx="4" fill="#FF3388"/>
            <rect x="63" y="16" width="8" height="24" rx="4" fill="#FF3388"/>
            <!-- Body -->
            <rect x="18" y="42" width="64" height="68" rx="20" fill="#FFE600" stroke="#121212" stroke-width="4"/>
            <!-- Cute Face -->
            <circle cx="38" cy="68" r="6" fill="#121212"/>
            <circle cx="62" cy="68" r="6" fill="#121212"/>
            <circle cx="40" cy="66" r="2" fill="#FFF"/>
            <circle cx="64" cy="66" r="2" fill="#FFF"/>
            <!-- Rosy Cheeks -->
            <circle cx="28" cy="76" r="5" fill="#FF3388" opacity="0.8"/>
            <circle cx="72" cy="76" r="5" fill="#FF3388" opacity="0.8"/>
            <!-- Snout & Smile -->
            <polygon points="50,73 45,78 55,78" fill="#FF3388" stroke="#121212" stroke-width="2"/>
            <path d="M 45 80 Q 50 86 55 80" stroke="#121212" stroke-width="3" fill="none" stroke-linecap="round"/>
            <!-- Star Medal -->
            <polygon points="50,92 53,99 60,99 54,103 56,110 50,106 44,110 46,103 40,99 47,99" fill="#00E5FF" stroke="#121212" stroke-width="2"/>
          </svg>
        `),
        preview: null,
        width: 100,
        height: 120,
        properties: { speed: 380, jumpForce: 650 }
      },
      {
        id: 'preset_neon_brick',
        name: 'Cyber Neon Brick',
        category: 'block',
        targetType: 'block',
        createdAt: '2026-10-18T12:00:00Z',
        dataUrl: makeSvgDataUrl(`
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
            <rect x="4" y="4" width="92" height="92" rx="14" fill="#00E5FF" stroke="#121212" stroke-width="6"/>
            <!-- Cyber Brick Pattern -->
            <rect x="14" y="14" width="72" height="32" rx="6" fill="#FFE600" stroke="#121212" stroke-width="4"/>
            <rect x="14" y="54" width="32" height="32" rx="6" fill="#FF3388" stroke="#121212" stroke-width="4"/>
            <rect x="54" y="54" width="32" height="32" rx="6" fill="#00E676" stroke="#121212" stroke-width="4"/>
            <!-- Center Bolt -->
            <circle cx="50" cy="50" r="8" fill="#121212"/>
            <circle cx="50" cy="50" r="4" fill="#FFF"/>
          </svg>
        `),
        preview: null,
        width: 100,
        height: 100,
        properties: { bounciness: 0.2 }
      },
      {
        id: 'preset_ghost_potato',
        name: 'Spooky Ghost Potato',
        category: 'enemy',
        targetType: 'enemy',
        createdAt: '2026-10-18T12:00:00Z',
        dataUrl: makeSvgDataUrl(`
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
            <!-- Ghost Body -->
            <path d="M 20 60 C 20 25, 80 25, 80 60 C 80 85, 70 85, 60 75 C 50 85, 40 85, 30 75 C 20 85, 20 75, 20 60 Z" fill="#B388FF" stroke="#121212" stroke-width="5"/>
            <!-- Big Cute Eyes -->
            <circle cx="40" cy="48" r="8" fill="#121212"/>
            <circle cx="64" cy="48" r="8" fill="#121212"/>
            <circle cx="42" cy="45" r="3" fill="#00E5FF"/>
            <circle cx="66" cy="45" r="3" fill="#00E5FF"/>
            <!-- Mischievous Mouth -->
            <path d="M 44 64 Q 52 74 60 64" stroke="#121212" stroke-width="4" fill="none" stroke-linecap="round"/>
          </svg>
        `),
        preview: null,
        width: 100,
        height: 100,
        properties: { speed: 80, stompable: true }
      },
      {
        id: 'preset_rainbow_star',
        name: 'Rainbow Star Gem',
        category: 'collectible',
        targetType: 'collectible',
        createdAt: '2026-10-18T12:00:00Z',
        dataUrl: makeSvgDataUrl(`
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
            <polygon points="50,6 63,35 95,37 70,58 78,89 50,72 22,89 30,58 5,37 37,35" fill="#FFE600" stroke="#121212" stroke-width="5"/>
            <!-- Sparkle Rings -->
            <circle cx="50" cy="50" r="14" fill="#FF3388" stroke="#121212" stroke-width="3"/>
            <circle cx="50" cy="50" r="7" fill="#00E5FF"/>
          </svg>
        `),
        preview: null,
        width: 100,
        height: 100,
        properties: {}
      }
    ];
  }
}
