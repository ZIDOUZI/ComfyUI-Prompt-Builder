from .web_button_node import TagSelector, CLIPTagEncode

NODE_CLASS_MAPPINGS = {
    "TagSelector": TagSelector,
    "CLIPTagEncode": CLIPTagEncode
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "TagSelector": "Tag Selector",
    "CLIPTagEncode": "CLIPTagEncode"
}

WEB_DIRECTORY = "./web"

__all__ = ['NODE_CLASS_MAPPINGS', 'NODE_DISPLAY_NAME_MAPPINGS', 'WEB_DIRECTORY']
