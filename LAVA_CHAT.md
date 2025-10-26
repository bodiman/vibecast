# 🌋 Lava Chat - AI-Powered Framework Interaction

Lava Chat is an innovative interface for interacting with VibeCast frameworks using AI models. It provides a seamless experience for configuring and chatting with AI about your frameworks.

## Features

### 🤖 Multi-Model Support
Select from various AI providers and models:
- **OpenAI**: GPT-4, GPT-4 Turbo, GPT-3.5 Turbo
- **Anthropic**: Claude 3 Opus, Sonnet, Haiku
- **Google**: Gemini Pro, Gemini Ultra
- **Local (Ollama)**: Llama 2, Mistral, Code Llama

### 📊 Framework Selection
- Visual checkbox interface for selecting frameworks
- Dynamic framework pool that updates as you select/deselect
- Selected frameworks displayed in a separate area below
- Easy removal via tag-based interface
- Real-time count of selected frameworks

### 🎯 Smooth Scroll Transitions
- **Configuration Section**: Choose your model and frameworks
- **Chat Section**: Interact with the AI about your selections
- Seamless transition between sections via:
  - Scroll wheel navigation
  - "Continue to Chat" button
  - "Back to Configuration" button
- Conversation persists when scrolling between sections

### 💬 Modern Chat Interface
- Clean, dark-themed design
- Typing indicators for AI responses
- Auto-resizing text input
- Message history preservation
- Visual distinction between user and AI messages
- Animated message appearance

## Usage

### Accessing Lava Chat

1. **From the Dashboard**: Click the "🌋 Lava Chat" button in the navbar
2. **Direct URL**: Navigate to `http://localhost:3000/lava`

### Configuration Flow

1. **Select AI Model**
   - Click the dropdown to see all available models
   - Each model displays info about its capabilities
   - Model selection is required to continue

2. **Select Frameworks**
   - Click on framework cards to select them
   - Selected frameworks show a checkmark and move to "Selected Frameworks"
   - Click the × on selected tags to remove them
   - At least one framework is required

3. **Continue to Chat**
   - Click "Continue to Chat" button, or
   - Scroll down to reveal the chat interface

### Chat Interaction

1. Type your message in the text area
2. Press Enter or click "Send" to submit
3. AI responds with context about your selected frameworks
4. Scroll up to modify configuration without losing chat history

## Design Highlights

### Color Scheme
- Background: `#1a1a1a` (dark)
- Primary Accent: `#ff6b35` (orange)
- Secondary Elements: `#2a2a2a` (medium dark)
- Text: `#e0e0e0` (light gray)

### Animations
- **fadeIn**: Smooth entry for messages and elements
- **slideIn**: Scale animation for selected tags
- **bounce**: Scroll hint animation
- **typing**: Pulsing dots for AI thinking indicator

### Responsive Layout
- Max-width containers for readability
- Flexible grid for framework cards
- Auto-adjusting chat message layout
- Mobile-friendly scroll behavior

## Technical Implementation

### State Management
```javascript
let selectedModel = null;
let selectedFrameworks = new Set();
let allFrameworks = [];
let chatHistory = [];
let isTyping = false;
```

### Key Functions
- `loadFrameworks()`: Fetches frameworks from API
- `toggleFramework()`: Adds/removes frameworks from selection
- `updateUI()`: Synchronizes UI with state
- `sendMessage()`: Handles chat message submission
- `addMessage()`: Appends messages to chat display
- `showTyping()`/`hideTyping()`: Manages typing indicator

### API Integration
- `GET /api/frameworks`: Loads available frameworks
- Future: AI model API integration for actual responses

## Future Enhancements

### Planned Features
1. **Real AI Integration**
   - Connect to actual AI model APIs
   - Stream responses for better UX
   - Context-aware framework analysis

2. **Advanced Framework Context**
   - Load framework graph data into chat context
   - Visual framework previews in chat
   - Node/edge exploration during conversation

3. **Session Persistence**
   - Save chat sessions to database
   - Resume previous conversations
   - Export chat transcripts

4. **Collaborative Features**
   - Share chat sessions
   - Multi-user framework collaboration
   - Real-time updates

5. **Enhanced UI**
   - Code syntax highlighting in messages
   - Markdown rendering for AI responses
   - Inline framework visualization
   - Voice input/output

## Development

### File Structure
```
public/
  lava-chat.html          # Main Lava Chat interface
src/
  server/
    FrameworkServer.ts    # Server with /lava route
```

### Running Locally
```bash
npm run dev
```

Then visit `http://localhost:3000/lava`

### Customization
- Model list: Edit the `<select>` options in `lava-chat.html`
- Model info: Update the `modelInfo` object
- Styling: Modify the `<style>` section
- AI responses: Update `generateResponse()` function

## Tips

1. **Model Selection**: Choose faster models (GPT-3.5, Claude Haiku) for quick iterations
2. **Framework Selection**: Select related frameworks for better AI context
3. **Scrolling**: Use scroll-snap sections for smooth navigation
4. **Chat History**: Your conversation persists while scrolling - configure anytime!

## Support

For issues or questions:
- Check the console for error messages
- Verify frameworks are loading from `/api/frameworks`
- Ensure the server is running on the correct port

---

**Built with ❤️ for the VibeCast Framework System**
