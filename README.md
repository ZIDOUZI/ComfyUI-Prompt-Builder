# ComfyUI Prompt Builder

A powerful tag-based prompt builder extension for ComfyUI that helps you create and manage prompts using a structured tag system.

## Features

- 📁 **Tag Organization**: Browse and select tags from organized YAML files
- 🔍 **Search**: Quickly find tags with search functionality
- ⚖️ **Weight Control**: Adjust tag weights with precision
- 🎨 **Theme Support**: Light and dark mode with system theme detection
- 📋 **Easy Copy**: One-click copy for tags
- 🔗 **Wiki Links**: Quick access to tag documentation
- 🏷️ **Alias Support**: Multiple variations for each tag

## Installation

1. Clone this repository into your ComfyUI custom nodes directory:
```bash
cd ComfyUI/custom_nodes
git clone https://github.com/YOUR_USERNAME/ComfyUI-prompt-builder.git
```

2. Add your own data at `data/*`. Folder is supported. See the `docs/tags.schema.json` file for the format.
  > or you can use these data instead: [Danbooru Diffusion Prompt Builder](https://github.com/wfjsw/danbooru-diffusion-prompt-builder/tree/master/data/tags)

2. Restart ComfyUI

## Usage

The extension provides two main nodes:

### Tag Selector
- Opens a tag selection interface
- Browse through categorized tags
- Add tags with customizable weights
- Outputs formatted prompt text

### CLIPTagEncode
- Converts tag-based prompts into CLIP embeddings
- Direct integration with CLIP model
- Supports dynamic prompts

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## TODO

- [ ] Make a global search
- [ ] Support fetch tag display name when web loaded
- [ ] Support create tag group

## Acknowledgments

- [ComfyUI](https://github.com/comfyanonymous/ComfyUI)
- [ComfyUI Prompt Builder](https://github.com/wfjsw/danbooru-diffusion-prompt-builder)