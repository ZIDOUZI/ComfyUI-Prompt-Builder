import os
import yaml
from aiohttp import web
from server import PromptServer


class TagSelector:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "text": ("STRING", {"default": "", "multiline": True, "dynamicPrompts": True})
            },
            "optional": {}
        }
    
    RETURN_TYPES = ("STRING",)
    FUNCTION = "execute"
    CATEGORY = "utils"

    def execute(self, text):
        return (text,)


class CLIPTagEncode:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "text": ("STRING", {"default": "", "multiline": True, "dynamicPrompts": True}),
                "clip": ("CLIP", {"tooltip": "The CLIP model used for encoding the text."})
            },
            "optional": {}
        }
    
    RETURN_TYPES = ("CONDITIONING",)
    FUNCTION = "execute"
    CATEGORY = "conditioning"

    def execute(self, text, clip):
        tokens = clip.tokenize(text)
        output = clip.encode_from_tokens(tokens, return_pooled=True, return_dict=True)
        cond = output.pop("cond")
        return ([[cond, output]], )


PromptServer.instance.routes.static(
    "/extensions/ComfyUI-prompt-builder/web/",
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "web/")
)

data_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
def build_structure(path, rel_path=""):
    result = {}
    try:
        for item in sorted(os.listdir(path)):  # Sort items for consistent order
            full_path = os.path.join(path, item)
            item_rel_path = os.path.join(rel_path, item) if rel_path else item
            
            if os.path.isdir(full_path):
                children = build_structure(full_path, item_rel_path)
                if children:  # Only add non-empty directories
                    result[item] = {
                        "type": "directory",
                        "path": item_rel_path.replace("\\", "/"),
                        "children": children
                    }
            elif item.endswith('.yaml'):
                result[item] = {
                    "type": "file",
                    "path": item_rel_path.replace("\\", "/")
                }
    except Exception as e:
        print(f"Error reading directory {path}: {str(e)}")
    return result

structure = build_structure(data_dir)
                
@PromptServer.instance.routes.get("/extensions/ComfyUI-prompt-builder/api/files")
async def get_structure(request):
    return web.json_response(structure)

@PromptServer.instance.routes.get("/extensions/ComfyUI-prompt-builder/api/tags")
async def get_tags(request):
    path = request.query.get("file", None)
    if path is None:
        return web.json_response([])
    try:
        with open(os.path.join(data_dir, path), "r", encoding='utf-8') as f:  # Explicitly use UTF-8
            full = yaml.safe_load(f)
            if isinstance(full, list):
                return web.json_response(full)
            content = full.get('content', full)
            if isinstance(content, list):
                return web.json_response(content)
            # adjusting https://github.com/wfjsw/danbooru-diffusion-prompt-builder/tree/master/data
            response = []
            for name, tag in content.items():
                tag['alias'] = tag.get('alias', [])
                tag['alias'].insert(0, name)
                response.append(tag)

            # We ignore other fields, since they should be decided by their folder.
            return web.json_response(response)
    except Exception as e:
        print(f"Error loading tags from {path}: {str(e)}")
        return web.json_response({"error": str(e)}, status=500)