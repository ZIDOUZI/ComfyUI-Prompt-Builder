/**
 * ComfyUI Prompt Builder - Editor Scripts
 */

// ==========================================================================
// Constants & State
// ==========================================================================
let selectedTags = {};
let tagStructure = null;
let currentTags = null;  // Store current displayed tags

// DOM Elements
const tagList = document.querySelector('.tags-list');
const tagCardsDiv = document.querySelector('.tag-cards');
const templates = document.getElementsByTagName('template')[0].content;
const tagListItem = templates.querySelector('.selected-tag').cloneNode(true);
const tagCard = templates.querySelector('.tag-card').cloneNode(true);
const fileItem = templates.querySelector('.file-item').cloneNode(true);
const folderItem = templates.querySelector('.folder-item').cloneNode(true);
const aliasItem = templates.querySelector('.alias-item').cloneNode(true);

// ==========================================================================
// Initialization
// ==========================================================================
document.addEventListener('DOMContentLoaded', async () => {
    initTheme();

    const searchInput = document.querySelector('#search-input');
    const clearSearch = document.querySelector('#clear-search-btn');
    
    // Initialize clear button visibility
    clearSearch.hidden = !searchInput.value;
    
    // Handle search input
    searchInput.oninput = debounce((e) => {
        clearSearch.hidden = !e.target.value;
        handleSearch(e);
    }, 300);
    
    // Handle clear button click
    clearSearch.onclick = (e) => {
        e.stopPropagation();
        searchInput.value = '';
        clearSearch.hidden = true;
        handleSearch({ target: searchInput });
        searchInput.focus();
    };

    await loadAllTagsWithStructure();
    initScrollToTop();  // Move initialization here, after structure is loaded

    // Get initial value from the node
    if (window.opener) {
        const textWidget = window.opener.app.graph._nodes_by_id[new URLSearchParams(window.location.search).get('nodeId')]?.widgets.find(w => w.name === "text");
        if (textWidget && textWidget.value) {
            textWidget.value
                .split(',')
                .map(t => t.trim())
                .filter(t => t)
                .forEach(tag => {
                    const parsedTags = parseTag(tag);
                    parsedTags.forEach(parsedTag => {
                        selectedTags[parsedTag.value] = { weight: parsedTag.weight };
                        addSelectedTagToUI(parsedTag.value);
                    });
                });
        }
    }
});

function initScrollToTop() {
    const scrollBtn = document.querySelector('#scroll-top');
    
    // Initial state
    scrollBtn.hidden = true;

    // Add scroll listener to the tag cards container
    tagCardsDiv.onscroll = () => scrollBtn.hidden = tagCardsDiv.scrollTop < 200;

    // Scroll to top when clicked
    scrollBtn.onclick = () => tagCardsDiv.scrollTo({ top: 0, behavior: 'smooth' });
}

// ==========================================================================
// Theme Management
// ==========================================================================
function initTheme() {
    const themeToggle = document.querySelector('#theme-toggle');
    const root = document.documentElement;

    // Set initial theme from localStorage or default to dark
    const savedTheme = localStorage.getItem('theme') || 'dark';
    root.setAttribute('data-theme', savedTheme);

    themeToggle.onclick = () => {
        const currentTheme = root.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

        root.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
    };
}

// ==========================================================================
// Search Functions
// ==========================================================================
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function handleSearch(event) {
    const searchTerm = event.target.value.toLowerCase();
    if (!currentTags) return;

    if (!searchTerm) {
        renderCards(currentTags);
        return;
    }

    const filteredTags = currentTags.filter(tag => {
        // Search in tag name
        if (tag.name.toLowerCase().includes(searchTerm)) return true;

        // Search in aliases
        return !!tag.alias?.some(alias => alias.toLowerCase().includes(searchTerm));
    });

    renderCards(filteredTags);
}

// ==========================================================================
// File Browser Functions
// ==========================================================================
async function loadAllTagsWithStructure() {
    try {
        const response = await fetch('/extensions/ComfyUI-prompt-builder/api/files');
        if (!response.ok) return console.error(response.error);
        tagStructure = { children: await response.json() };
        renderFileBrowser(tagStructure);
    } catch (error) {
        console.error('Error loading tag structure:', error);
    }
}

async function loadTagsFromFile(filePath) {
    // If we already have the tags in the structure, use them
    let currentNode = tagStructure;
    const pathParts = filePath.split('/');

    for (const part of pathParts) {
        if (!currentNode?.children?.[part]) {
            console.error('Path not found in structure:', filePath);
            return;
        }
        currentNode = currentNode.children[part];
    }

    if (currentNode.tags) {
        currentTags = currentNode.tags;  // Store current tags
        renderCards(currentNode.tags);
        return;
    }

    // Fallback to API request if tags not in structure
    try {
        const response = await fetch(`/extensions/ComfyUI-prompt-builder/api/tags?file=${filePath}`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const tags = await response.json();
        currentNode.tags = tags;  // Cache the tags in structure
        currentTags = tags;  // Store current tags
        renderCards(tags);
    } catch (error) {
        console.error('Error loading tags:', error);
    }
}

function renderFileBrowser(structure) {
    const fileBrowser = document.querySelector('#file-browser');
    fileBrowser.innerHTML = '';

    function createItem(name, data) {
        let element;

        if (data.type === 'directory') {
            element = document.importNode(folderItem, true);
            element.querySelector('.folder-name').textContent = name;

            const header = element.querySelector('.folder-header');
            const content = element.querySelector('.folder-content');

            header.onclick = (e) => {
                e.stopPropagation();
                content.hidden = !content.hidden;
            };

            if (data.children) {
                Object.entries(data.children)
                    .sort(([nameA, dataA], [nameB, dataB]) => {
                        if (dataA.type !== dataB.type) return dataA.type === 'directory' ? -1 : 1;
                        return nameA.localeCompare(nameB);
                    }).forEach(([childName, childData]) => {
                        content.appendChild(createItem(childName, childData));
                    });
            }
        } else {
            element = document.importNode(fileItem, true);
            element.querySelector('.file-name').textContent = name.replace(/\.ya?ml$/, '');

            element.onclick = (e) => {
                tagCardsDiv.scrollTop = 0;  // Reset scroll position instantly
                e.stopPropagation();
                loadTagsFromFile(data.path);
                document.querySelector('.file-item.active')?.classList.remove('active');
                element.classList.add('active');
            };
        }

        return element;
    }

    // Sort entries: directories first, then files
    Object.entries(structure.children).sort(([, a], [, b]) => {
        return a.type === b.type ? 0 : a.type === 'directory' ? -1 : 1;
    }).forEach(([name, data]) => {
        fileBrowser.appendChild(createItem(name, data));
    });
}

// ==========================================================================
// Tag Card Functions
// ==========================================================================
function renderCards(tags) {
    tagCardsDiv.innerHTML = '';

    tags.forEach(tag => {
        const element = document.importNode(tagCard, true);

        // Set content
        element.querySelector('.tag-title').textContent = tag.name;

        if (tag.wikiURL) element.querySelector('#link-btn').onclick = async (e) => {
            e.stopPropagation();
            window.open(tag.wikiURL, '_blank');
        };

        // Add action button handlers
        element.querySelector('#copy-btn').onclick = async (e) => {
            e.stopPropagation();
            await navigator.clipboard.writeText(tag.name);
        };

        // Create alias elements using template
        if (tag.alias && tag.alias.length > 0) {
            const aliasContainer = element.querySelector('.tag-alias');
            aliasContainer.innerHTML = '';

            tag.alias.forEach(alias => {
                const newAliasItem = document.importNode(aliasItem, true);
                if (selectedTags[alias]) newAliasItem.classList.add('selected');
                newAliasItem.id = `n-${alias.replaceAll(' ', '_')}`;
                newAliasItem.querySelector('.alias-text').textContent = alias;
                newAliasItem.querySelector('.like-btn').onclick = (e) => {
                    e.stopPropagation();
                    toggleTag(alias, tag.name);
                };
                aliasContainer.appendChild(newAliasItem);
            });
        }

        element.querySelector('.tag-description').textContent = tag.description;

        tagCardsDiv.appendChild(element);
    });
}

// ==========================================================================
// Selected Tags Functions
// ==========================================================================
function addSelectedTagToUI(name, displayName) {
    const safeId = name.replaceAll(' ', '_');
    const element = document.importNode(tagListItem, true);
    element.id = `n-${safeId}`;

    const tagNameElement = element.querySelector('.tag-name');
    const tagNameText = displayName ? `${name} - ${displayName}` : name;
    tagNameElement.innerHTML = `${tagNameText} <span class="tag-weight">×${selectedTags[name].weight.toFixed(3)}</span>`;

    function changeWeight(increase) {
        const weight = (selectedTags[name]?.weight || 1.0) + (increase ? 0.05 : -0.05);
        selectedTags[name].weight = weight;
        tagNameElement.innerHTML = `${tagNameText} <span class="tag-weight">×${weight.toFixed(3)}</span>`;
    }

    element.querySelector('.increase-weight').onclick = () => changeWeight(true);
    element.querySelector('.decrease-weight').onclick = () => changeWeight(false);
    element.querySelector('.remove-tag').onclick = () => {
        delete selectedTags[name];
        element.remove();
    };

    tagList.appendChild(element);
}

function toggleTag(name, displayName) {
    const safeId = name.replaceAll(' ', '_');
    if (selectedTags[name]) {
        delete selectedTags[name];
        tagList.querySelector(`.selected-tag#n-${safeId}`)?.remove();
    } else {
        selectedTags[name] = { weight: 1.0 };
        addSelectedTagToUI(name, displayName);
    }

    document.querySelector(`.alias-item#n-${safeId}`)?.classList.toggle('selected');
}

// ==========================================================================
// Window Communication Functions
// ==========================================================================
async function commitAndClose() {
    await commitChanges();
    window.close();
}

function justClose() {
    window.close();
}

async function commitChanges() {
    const tagString = Object.entries(selectedTags)
        .map(([tagName, data]) => {
            const weight = data.weight;
            return weight === 1.0 ? tagName : `${tagName}:${weight.toFixed(2)}`;
        })
        .join(', ');

    if (window.opener) {
        const textWidget = window.opener.app.graph._nodes_by_id[new URLSearchParams(window.location.search).get('nodeId')]?.widgets.find(w => w.name === "text");
        if (textWidget) {
            textWidget.value = tagString;
            window.opener.app.graph.setDirtyCanvas(true, true);
        }
    } else {
        console.error("No opener found");
    }
}

// ==========================================================================
// Tag Parsing Functions
// ==========================================================================
function parseTag(tagString) {
    let pos = 0;

    function parseValue() {
        skipWhitespace();

        // Handle empty string
        if (pos >= tagString.length) {
            return null;
        }

        // Handle groups
        if (tagString[pos] === '(') {
            return parseGroup();
        }

        // Handle plain tags
        return parsePlain();
    }

    function parseGroup() {
        pos++; // Skip opening parenthesis
        const group = {
            type: 'group',
            value: [],
            weight: 1.0
        };

        while (pos < tagString.length && tagString[pos] !== ')') {
            const tag = parseValue();
            if (tag) {
                group.value.push(tag);
            }

            skipWhitespace();
            if (tagString[pos] === ',') {
                pos++; // Skip comma
            }
        }

        if (pos < tagString.length && tagString[pos] === ')') {
            pos++; // Skip closing parenthesis

            // Check for weight after group
            const weight = parseWeight();
            if (weight !== null) {
                group.weight = weight;
                group.value = group.value.map(tag => ({
                    ...tag,
                    weight: tag.weight * weight
                }));
            }
        }

        return group;
    }

    function parsePlain() {
        let value = '';
        while (pos < tagString.length && !/[,():]/g.test(tagString[pos])) {
            value += tagString[pos];
            pos++;
        }

        value = value.trim();
        if (!value) return null;

        const tag = {
            type: 'plain',
            value: value,
            weight: 1.0
        };

        // Check for weight
        const weight = parseWeight();
        if (weight !== null) {
            tag.weight = weight;
        }

        return tag;
    }

    function parseWeight() {
        skipWhitespace();
        if (pos < tagString.length && tagString[pos] === ':') {
            pos++; // Skip colon
            let weightStr = '';
            while (pos < tagString.length && /[\d.]/g.test(tagString[pos])) {
                weightStr += tagString[pos];
                pos++;
            }
            return parseFloat(weightStr) || 1.0;
        }
        return null;
    }

    function skipWhitespace() {
        while (pos < tagString.length && /\s/.test(tagString[pos])) {
            pos++;
        }
    }

    // Parse all tags
    const tags = [];

    while (pos < tagString.length) {
        const tag = parseValue();
        if (tag) {
            if (tag.type === 'group') {
                tags.push(...tag.value);
            } else {
                tags.push(tag);
            }
        }

        skipWhitespace();
        if (tagString[pos] === ',') {
            pos++; // Skip comma
        }
    }

    return tags;
}