import json
import os

BASE_DIR    = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_FILE   = os.path.join(BASE_DIR, 'data', 'trades.json')
MAP_FILE    = os.path.join(BASE_DIR, 'data', 'cloudinary_migration_map.json')
UPLOADS_DIR = os.path.join(BASE_DIR, 'static', 'uploads')

def clean_dead_links():
    if not os.path.exists(DATA_FILE): return
    
    with open(DATA_FILE, 'r', encoding='utf-8') as f:
        data = json.load(f)
        
    url_map = {}
    if os.path.exists(MAP_FILE):
        with open(MAP_FILE, 'r', encoding='utf-8') as f:
            url_map = json.load(f)

    stats = {'dead': 0, 'migrated': 0}
    
    def process_url(url):
        if not isinstance(url, str): return url
        if not url.startswith('/uploads/'): return url
        
        # 1. Check map
        if url in url_map:
            stats['migrated'] += 1
            return url_map[url]
        
        # 2. Check local file
        filename = url.replace('/uploads/', '')
        local_path = os.path.join(UPLOADS_DIR, filename)
        if os.path.exists(local_path):
            return url # Keep it, but it should ideally be migrated
            
        # 3. Dead link
        stats['dead'] += 1
        return None

    def clean_obj(obj):
        if not isinstance(obj, dict): return
        
        # images array
        if 'images' in obj and isinstance(obj['images'], list):
            new_imgs = []
            for u in obj['images']:
                res = process_url(u)
                if res: new_imgs.append(res)
            obj['images'] = new_imgs

        # imageTags
        if 'imageTags' in obj and isinstance(obj['imageTags'], dict):
            new_tags = {}
            for u, t in obj['imageTags'].items():
                res = process_url(u)
                if res: new_tags[res] = t
            obj['imageTags'] = new_tags

        # marqueeBoxes
        if 'marqueeBoxes' in obj and isinstance(obj['marqueeBoxes'], dict):
            new_boxes = {}
            for u, b in obj['marqueeBoxes'].items():
                res = process_url(u)
                if res: new_boxes[res] = b
            obj['marqueeBoxes'] = new_boxes

        # overlays
        if 'overlays' in obj and isinstance(obj['overlays'], dict):
            new_overlays = {}
            for u, o in obj['overlays'].items():
                res_u = process_url(u)
                res_o = process_url(o)
                if res_u: new_overlays[res_u] = res_o
            obj['overlays'] = new_overlays

        # subImages
        if 'subImages' in obj and isinstance(obj['subImages'], dict):
            new_subs = {}
            for u, s in obj['subImages'].items():
                res_u = process_url(u)
                if res_u:
                    new_list = []
                    if isinstance(s, list):
                        for sub in s:
                            res_sub = process_url(sub)
                            if res_sub: new_list.append(res_sub)
                    new_subs[res_u] = new_list
            obj['subImages'] = new_subs

    # Fix trades
    for t in data.get('trades', []):
        clean_obj(t)

    # Fix dayData
    for dKey, dVal in data.get('dayData', {}).items():
        clean_obj(dVal)

    print(f"Cleanup complete.")
    print(f"Migrated to Cloudinary (using map): {stats['migrated']}")
    print(f"Removed dead links: {stats['dead']}")

    with open(DATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2)

if __name__ == "__main__":
    clean_dead_links()
