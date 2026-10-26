// Sidehop Universal Package Format (.sidehop)
// Standardized file format for sharing Sidehop levels and personal visual assets

export class SidehopFile {
  static FORMAT_NAME = 'sidehop';
  static FORMAT_VERSION = 1;
  static MIME_TYPE = 'application/x-sidehop+json';

  // 1. Create a Level Package (.sidehop)
  static createLevelPackage(levelData, metadata = {}) {
    return {
      format: this.FORMAT_NAME,
      version: this.FORMAT_VERSION,
      kind: 'level',
      meta: {
        title: metadata.title || levelData.name || 'Sidehop Level',
        creator: metadata.creator || "John O'Brien",
        createdAt: new Date().toISOString(),
        app: 'Sidehop',
        description: metadata.description || 'Platformer level created with Sidehop',
        tags: metadata.tags || ['level', 'platformer']
      },
      level: {
        version: levelData.version || 2,
        name: levelData.name || 'Starter World',
        background: levelData.background || { theme: 'sky', customImage: null },
        player: levelData.player,
        entities: levelData.entities || []
      }
    };
  }

  // 2. Create a Personal Asset Package (.sidehop)
  static createAssetPackage(assetData, metadata = {}) {
    const assetId = assetData.id || ('asset_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6));
    const title = assetData.name || metadata.title || 'Sidehop Personal Asset';
    return {
      format: this.FORMAT_NAME,
      version: this.FORMAT_VERSION,
      kind: 'asset',
      meta: {
        title: title,
        creator: metadata.creator || "John O'Brien",
        createdAt: new Date().toISOString(),
        app: 'Sidehop',
        description: metadata.description || 'Personal visual asset for Sidehop',
        tags: metadata.tags || [assetData.category || 'sprite', 'asset']
      },
      asset: {
        id: assetId,
        name: title,
        category: assetData.category || 'sprite', // 'player', 'block', 'enemy', 'collectible', 'spring', 'hazard', 'background', 'sprite'
        targetType: assetData.targetType || 'all',
        dataUrl: assetData.dataUrl,
        preview: assetData.preview || assetData.dataUrl,
        width: assetData.width || 220,
        height: assetData.height || 220,
        properties: assetData.properties || {}
      }
    };
  }

  // 3. Create a Bundle Package (.sidehop) for level + assets or asset packs
  static createBundlePackage(levelData, assets = [], metadata = {}) {
    return {
      format: this.FORMAT_NAME,
      version: this.FORMAT_VERSION,
      kind: 'bundle',
      meta: {
        title: metadata.title || 'Sidehop Asset & Level Bundle',
        creator: metadata.creator || "John O'Brien",
        createdAt: new Date().toISOString(),
        app: 'Sidehop',
        description: metadata.description || 'Bundle containing Sidehop assets and levels',
        tags: metadata.tags || ['bundle', 'assets']
      },
      level: levelData || null,
      assets: assets
    };
  }

  // 4. Parse incoming file data (supporting .sidehop packages, legacy JSON, and raw assets)
  static parse(input) {
    let data;
    if (typeof input === 'string') {
      try {
        data = JSON.parse(input);
      } catch (err) {
        throw new Error('File is not valid JSON content');
      }
    } else {
      data = input;
    }

    if (!data || typeof data !== 'object') {
      throw new Error('Invalid Sidehop data structure');
    }

    // A. Explicit .sidehop envelope format
    if (data.format === this.FORMAT_NAME || data.sidehop) {
      const kind = data.kind || data.type || (data.level ? 'level' : data.asset ? 'asset' : 'bundle');

      if (kind === 'level') {
        return {
          valid: true,
          kind: 'level',
          level: data.level,
          meta: data.meta || data.metadata || { title: data.level?.name || 'Sidehop Level' }
        };
      }

      if (kind === 'asset') {
        return {
          valid: true,
          kind: 'asset',
          asset: data.asset,
          meta: data.meta || data.metadata || { title: data.asset?.name || 'Personal Asset' }
        };
      }

      if (kind === 'bundle') {
        return {
          valid: true,
          kind: 'bundle',
          level: data.level || null,
          assets: Array.isArray(data.assets) ? data.assets : [],
          meta: data.meta || data.metadata || { title: 'Asset Bundle' }
        };
      }
    }

    // B. Legacy or Direct Level JSON: has 'entities' or 'player'
    if (Array.isArray(data.entities) || data.player) {
      return {
        valid: true,
        kind: 'level',
        level: data,
        meta: {
          title: data.name || 'Sidehop Level',
          creator: "John O'Brien",
          legacy: true
        }
      };
    }

    // C. Direct Asset JSON or image asset: has 'dataUrl' or 'category'
    if (data.dataUrl || data.customVisual || (data.category && (data.data || data.image))) {
      const asset = {
        id: data.id || ('asset_' + Date.now()),
        name: data.name || data.title || 'Personal Asset',
        category: data.category || 'sprite',
        targetType: data.targetType || 'all',
        dataUrl: data.dataUrl || data.customVisual || data.data || data.image,
        preview: data.preview || data.dataUrl || data.customVisual,
        width: data.width || 220,
        height: data.height || 220,
        properties: data.properties || {}
      };
      return {
        valid: true,
        kind: 'asset',
        asset: asset,
        meta: { title: asset.name, legacy: true }
      };
    }

    // D. Multi-asset array
    if (Array.isArray(data)) {
      return {
        valid: true,
        kind: 'bundle',
        level: null,
        assets: data,
        meta: { title: 'Imported Asset List' }
      };
    }

    throw new Error('Unrecognized Sidehop file format.');
  }

  // 5. Trigger browser download of a .sidehop file
  static download(filename, packageObj) {
    let cleanName = filename || 'sidehop-export';
    if (!cleanName.endsWith('.sidehop')) {
      cleanName += '.sidehop';
    }

    const jsonStr = JSON.stringify(packageObj, null, 2);
    const blob = new Blob([jsonStr], { type: this.MIME_TYPE });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = cleanName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
}
