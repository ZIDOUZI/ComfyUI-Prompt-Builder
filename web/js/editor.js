/**
 * ComfyUI Prompt Builder - Editor Scripts
 */

// ==========================================================================
// Constants & State
// ==========================================================================
let tagStructure;
let currentTags;  // Store current displayed tags

// Get text widget from source page
const textWidget = window.opener.app.graph._nodes_by_id[new URLSearchParams(window.location.search).get('nodeId')]?.widgets.find(w => w.name === "text");

// DOM Elements
const tagList = document.querySelector('.tags-list');
const tagCardsDiv = document.querySelector('.tag-cards');
const templates = document.getElementsByTagName('template')[0].content;
const tagListItem = templates.querySelector('.selected-tag').cloneNode(true);
const tagCard = templates.querySelector('.tag-card').cloneNode(true);
const fileItem = templates.querySelector('.list-item.file').cloneNode(true);
const folderItem = templates.querySelector('.list-item.folder').cloneNode(true);
const aliasItem = templates.querySelector('.alias-item').cloneNode(true);

// Auto-scroll variables
let autoScrollInterval = null;
const SCROLL_SPEED = 5;
const SCROLL_ZONE = 50; // pixels from edge to trigger scroll

// ==========================================================================
// Initialization
// ==========================================================================
document.addEventListener('DOMContentLoaded', async () => {
    initTheme();
    initSearch();
    initScrollToTop();

    await loadAllTagsWithStructure();

    parseTag(textWidget.value).forEach(tag => {
        const displayName = tagStructure.flatten.find(t => t.alias.includes(tag.value))?.name;
        addSelectedTagToUI(tag.value, displayName);
    });
});

function initScrollToTop() {
    const scrollBtn = document.querySelector('#scroll-top');
    scrollBtn.hidden = true;
    tagCardsDiv.onscroll = () => scrollBtn.hidden = tagCardsDiv.scrollTop < 200;
    scrollBtn.onclick = () => tagCardsDiv.scrollTo({ top: 0, behavior: 'smooth' });
}

function initSearch() {
    const searchInput = document.querySelector('#search-input');
    const clearSearch = document.querySelector('#clear-search-btn');

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
}

function initTheme() {
    const themeToggle = document.querySelector('#theme-toggle');
    const root = document.documentElement;

    root.setAttribute('data-theme', localStorage.getItem('theme') || 'dark');

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

async function handleSearch(event) {
    const searchTerm = event.target.value.toLowerCase();
    if (!tagStructure?.flatten) return;

    if (!searchTerm) return await renderCards(currentTags || []);

    searchEntries = currentTags && currentTags.length !== 0 ? currentTags : tagStructure.flatten;

    const filteredTags = searchEntries.filter(tag => {
        // Search in tag name
        if (tag.name.toLowerCase().includes(searchTerm)) return true;

        // Search in aliases
        return !!tag.alias?.some(alias => alias.toLowerCase().includes(searchTerm));
    });

    await renderCards(filteredTags);
}

// ==========================================================================
// File Browser Functions
// ==========================================================================
async function loadAllTagsWithStructure() {
    try {
        const response = await fetch('/extensions/ComfyUI-prompt-builder/api/files');
        if (!response.ok) return console.error(response.error);
        tagStructure = { children: await response.json(), flatten: [] };
        await traverse();
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
            return [];
        }
        currentNode = currentNode.children[part];
    }

    if (currentNode.tags) {
        currentTags = currentNode.tags;  // Store current tags
        return currentNode.tags
    }

    // Fallback to API request if tags not in structure
    try {
        const response = await fetch(`/extensions/ComfyUI-prompt-builder/api/tags?file=${filePath}`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const tags = await response.json();
        currentNode.tags = tags;  // Cache the tags in structure]
        return tags;  // Store current tags
    } catch (error) {
        console.error('Error loading tags:', error);
    }
}

async function traverse() {
    const fileBrowser = document.querySelector('#file-browser');
    fileBrowser.querySelector('.list-item#reset').onclick = async (e) => {
        e.stopPropagation();
        currentTags = [];
        await renderCards(currentTags);
    };

    function compare([nameA, dataA], [nameB, dataB]) {
        if (dataA.type !== dataB.type) return dataA.type === 'directory' ? -1 : 1;
        return nameA.localeCompare(nameB);
    }

    async function inner(array, base) {
        for (const [name, data] of array.sort(compare)) {
            let element;
            if (data.type === 'directory') {
                element = document.importNode(folderItem, true);
                const content = element.querySelector('.content');
                element.querySelector('.name').textContent = name;
                element.querySelector('.header').onclick = (e) => {
                    e.stopPropagation();
                    content.hidden = !content.hidden;
                };

                await inner(Object.entries(data.children), element.querySelector('.content'));
            } else {
                element = document.importNode(fileItem, true);
                element.querySelector('.name').textContent = name.replace(/\.ya?ml$/, '');
                element.onclick = async (e) => {
                    tagCardsDiv.scrollTop = 0;  // Reset scroll position instantly
                    e.stopPropagation();
                    currentTags = await loadTagsFromFile(data.path);
                    await renderCards(currentTags);
                    document.querySelector('.list-item.file.active')?.classList.remove('active');
                    element.classList.add('active');
                };

                tagStructure.flatten.push(...await loadTagsFromFile(data.path));
            }

            base.appendChild(element);
        }
    }

    // Sort entries: directories first, then files
    await inner(Object.entries(tagStructure.children), fileBrowser);
}

// ==========================================================================
// Tag Card Functions
// ==========================================================================
async function renderCards(tags) {
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
                const aliasElement = document.importNode(aliasItem, true);
                aliasElement.id = `n-${alias.replace(/[/ ]/g, '_')}`;
                if (tagList.querySelector(`.selected-tag#n-${aliasElement.id}`)) aliasElement.classList.add('selected');
                aliasElement.querySelector('.alias-text').textContent = alias;
                aliasElement.querySelector('.like-btn').onclick = (e) => {
                    e.stopPropagation();
                    toggleTag(alias, tag.name);
                };
                aliasContainer.appendChild(aliasElement);
            });
        }

        element.querySelector('.tag-description').textContent = tag.description;

        tagCardsDiv.appendChild(element);
    });
}

// ==========================================================================
// Selected Tags Functions
// ==========================================================================
function sortSelectedTags() {
    // Get all selected tags and sort them based on their position in flatten
    const selectedTagElements = Array.from(tagList.children);
    selectedTagElements.sort((a, b) => {
        const nameA = a['data-name'];
        const nameB = b['data-name'];
        return tagStructure.flatten.findIndex(t => t.alias.includes(nameA)) - tagStructure.flatten.findIndex(t => t.alias.includes(nameB));
    });

    // Re-append tags in sorted order
    selectedTagElements.forEach(tag => tagList.appendChild(tag));
}

function findIndicator() {
    let line = tagList.querySelector('.drag-insert-line');
    if (line) return line;
    line = document.createElement('div');
    line.className = 'drag-insert-line';
    tagList.appendChild(line);
    return line;
}

function handleDragStart(e) {
    const item = e.target.closest('.selected-tag');
    if (!item) return;
    
    item.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', item['data-name']);

    // Start auto-scroll if near edges
    startAutoScroll(e);
}

function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    const item = e.target.closest('.selected-tag');
    if (!item || item.classList.contains('dragging')) return;

    // Get the container's scroll position and bounds
    const containerRect = tagList.getBoundingClientRect();
    const rect = item.getBoundingClientRect();
    
    // Calculate if we should insert before or after based on mouse position
    const insertBefore = (e.clientY - rect.top) < (rect.height / 2);
    
    const listIndicator = findIndicator();
    // Update insert line position
    listIndicator.style.top = insertBefore ? 
        (rect.top - containerRect.top) + 'px' : 
        (rect.bottom - containerRect.top) + 'px';
    
    listIndicator.classList.toggle('drag-insert-before', insertBefore);
}

function handleDragEnd(e) {
    cleanupDrag();
}

function handleDrop(e) {
    e.preventDefault();
    const draggedItem = tagList.querySelector('.dragging');
    const dropTarget = e.target.closest('.selected-tag');
    
    if (dropTarget && draggedItem && dropTarget !== draggedItem) {
        if (tagList.querySelector('.drag-insert-line.drag-insert-before')) {
            dropTarget.parentNode.insertBefore(draggedItem, dropTarget);
        } else {
            dropTarget.parentNode.insertBefore(draggedItem, dropTarget.nextSibling);
        }
    }
    cleanupDrag();
}

function cleanupDrag() {
    const indicator = findIndicator();
    indicator?.['data-interval'] && clearInterval(indicator['data-interval']);
    indicator?.remove();
    tagList.querySelector('.dragging')?.classList.remove('dragging');
}

function startAutoScroll(e) {

    const container = tagList;
    const containerRect = tagList.getBoundingClientRect();
    const scrollTop = tagList.scrollTop;
    
    // Distance from mouse to top/bottom edges
    const distanceFromTop = e.clientY - containerRect.top;
    const distanceFromBottom = containerRect.bottom - e.clientY;
    
    // Calculate scroll direction and speed
    let scrollAmount = 0;
    if (distanceFromTop < SCROLL_ZONE) {
        // Scroll up - speed increases as you get closer to edge
        scrollAmount = -SCROLL_SPEED * (1 - distanceFromTop / SCROLL_ZONE);
    } else if (distanceFromBottom < SCROLL_ZONE) {
        // Scroll down - speed increases as you get closer to edge
        scrollAmount = SCROLL_SPEED * (1 - distanceFromBottom / SCROLL_ZONE);
    }
    
    if (scrollAmount !== 0) {
        findIndicator()['data-interval'] = setInterval(() => {
            const newScrollTop = container.scrollTop + scrollAmount;
            if (newScrollTop >= 0 && newScrollTop <= container.scrollHeight - container.clientHeight) {
                container.scrollTop = newScrollTop;
                // Trigger dragover to update insert line position
                const elementAtPoint = document.elementFromPoint(e.clientX, e.clientY);
                if (elementAtPoint) {
                    const event = new MouseEvent('dragover', {
                        clientX: e.clientX,
                        clientY: e.clientY,
                        bubbles: true
                    });
                    elementAtPoint.dispatchEvent(event);
                }
            }
        }, 16); // ~60fps
    }
}

function addSelectedTagToUI(name, displayName, weight = 1.0) {
    const safeId = name.replace(/[/ ]/g, '_');
    const element = document.importNode(tagListItem, true);
    element.id = `n-${safeId}`;
    element['data-name'] = name;
    element['data-weight'] = weight;

    const tagNameElement = element.querySelector('.tag-name');
    tagNameElement.draggable = true;
    tagNameElement.ondragstart = handleDragStart;
    element.ondragover = handleDragOver;
    element.ondrop = handleDrop;
    tagNameElement.ondragend = handleDragEnd;

    const tagNameText = displayName ? `${name} - ${displayName}` : name;
    tagNameElement.innerHTML = `${tagNameText} <span class="tag-weight">×${weight.toFixed(3)}</span>`;

    function changeWeight(increase) {
        weight = element['data-weight'];
        element['data-weight'] = weight = increase ? weight + 0.05 : weight - 0.05;
        tagNameElement.innerHTML = `${tagNameText} <span class="tag-weight">×${weight.toFixed(3)}</span>`;
    }

    element.querySelector('.increase-weight').onclick = () => changeWeight(true);
    element.querySelector('.decrease-weight').onclick = () => changeWeight(false);
    element.querySelector('.remove-tag').onclick = () => element.remove();

    tagList.appendChild(element);
}

function toggleTag(name, displayName) {
    const safeId = name.replaceAll(/[/ ]/g, '_');
    const selected = tagList.querySelector(`.selected-tag#n-${safeId}`);
    if (selected) {
        selected.remove();
    } else {
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
    textWidget.value = tagList.querySelectorAll('.selected-tag').map(tag => {
        const name = tag['data-name'];
        const weight = tag['data-weight'];
        return weight === 1.0 ? name : `${name}:${weight.toFixed(2)}`;
    }).join(', ');
    window.opener.app.graph.setDirtyCanvas(true, true);
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
        tags.push(tag);

        skipWhitespace();
        if (tagString[pos] === ',') {
            pos++; // Skip comma
        }
    }

    return tags;
}