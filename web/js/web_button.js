import { app } from "../../../scripts/app.js";

function addWebButtonWidget(node) {

    const widget = {
        name: "button",
        type: "button",
        callback: async function () {
            const editorUrl = new URL(window.location.origin + '/extensions/ComfyUI-prompt-builder/web/editor.html');
            editorUrl.searchParams.set('nodeId', node.id);

            const textWidget = node.widgets.find(w => w.name === "text");
            if (!textWidget) return console.error("Text widget not found");
            // Create and configure the popup window
            const newWindow = window.open(editorUrl.toString(), "_blank", "width=1400,height=800");
        },
    };
    
    // Add button widget
    node.addWidget("button", "Edit Text", "button", () => widget.callback());
}

app.registerExtension({
    name: "TagSelector",
    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        if (nodeData.name === "TagSelector" || nodeData.name === "CLIPTagEncode") {
            const onNodeCreated = nodeType.prototype.onNodeCreated;
            nodeType.prototype.onNodeCreated = function () {
                const r = onNodeCreated ? onNodeCreated.apply(this, arguments) : undefined;
                addWebButtonWidget(this);
                this.id = crypto.randomUUID();
                return r;
            };
        }
    },
});
