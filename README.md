# Paper Danmaku

**Read and Review Papers with Others and AI Agent**

Paper Danmaku is a collaborative research paper annotation platform that allows researchers, students, and reading groups to add fixed annotations (danmaku) to PDF documents. Unlike traditional scrolling bullet comments, these annotations stay connected to specific text, figures, tables, and equations in the paper.

## Features

### Core Annotation System
- **Fixed Annotations**: Annotations remain anchored to specific regions in the PDF, including text passages, figures, tables, and equations.
- **LaTeX Support**: Write mathematical formulas using LaTeX syntax with live preview powered by KaTeX.
- **Custom Colors**: Choose from 8 vibrant colors to categorize and personalize annotations.
- **Drag & Drop**: Reposition annotation bubbles anywhere on the page while maintaining their connection to highlighted regions.
- **Delete Functionality**: Remove annotations via the X button on the annotation box or from the left panel.

### AI Companion
- **OpenAI Integration**: Connect your own OpenAI API key to enable AI-powered annotation generation.
- **Smart Analysis**: AI analyzes the current PDF page and suggests annotations for equations, conclusions, methods, definitions, results, insights, and questions.
- **Exact Text Matching**: AI identifies specific sentences and paragraphs to annotate, with the system highlighting the exact text in the PDF.
- **Confidence Scores**: Each AI suggestion includes a confidence score and detailed explanation.

### Collaboration
- **Multi-User Support**: See annotations from all users in real-time.
- **User Filtering**: Filter annotations by user to focus on specific contributors.
- **Type Filtering**: Filter annotations by type (text, figures, tables, equations).

## File Structure

```
danmaku-showcase/
├── client/                          # Frontend React application
│   ├── public/
│   │   ├── sample-paper.pdf         # Demo PDF (Attention Is All You Need)
│   │   └── images/                  # Static image assets
│   ├── src/
│   │   ├── components/
│   │   │   ├── ai/                  # AI Companion components
│   │   │   │   ├── AICompanionPanel.tsx    # Main AI panel with suggestions
│   │   │   │   ├── AISettingsPanel.tsx     # API key configuration dialog
│   │   │   │   └── index.ts
│   │   │   ├── annotations/         # Annotation system components
│   │   │   │   ├── AnnotationDanmaku.tsx   # Individual annotation display
│   │   │   │   ├── AnnotationPanel.tsx     # Left sidebar panel
│   │   │   │   └── index.ts
│   │   │   ├── danmaku/             # Legacy danmaku components
│   │   │   ├── ui/                  # shadcn/ui components
│   │   │   ├── PdfAnnotationViewer.tsx     # Main PDF viewer with annotations
│   │   │   ├── PdfViewer.tsx        # Base PDF rendering component
│   │   │   ├── CodeBlock.tsx        # Syntax-highlighted code display
│   │   │   ├── ComponentCard.tsx    # Component documentation cards
│   │   │   └── ArchitectureDiagram.tsx     # Visual architecture diagram
│   │   ├── contexts/
│   │   │   └── ThemeContext.tsx     # Dark/light theme management
│   │   ├── hooks/                   # Custom React hooks
│   │   ├── lib/
│   │   │   ├── ai-service.ts        # AI API service and text matching
│   │   │   └── utils.ts             # Utility functions
│   │   ├── pages/
│   │   │   ├── Home.tsx             # Main landing page with demo
│   │   │   └── NotFound.tsx         # 404 page
│   │   ├── App.tsx                  # Root component with routing
│   │   ├── main.tsx                 # Application entry point
│   │   └── index.css                # Global styles and Tailwind config
│   └── index.html                   # HTML template
├── server/                          # Express server (for production)
│   └── index.ts                     # Server entry point
├── shared/                          # Shared types and constants
│   └── const.ts
├── package.json                     # Dependencies and scripts
├── tsconfig.json                    # TypeScript configuration
├── vite.config.ts                   # Vite build configuration
└── README.md                        # This file
```

## Technology Stack

| Category | Technology |
|----------|------------|
| Frontend Framework | React 19 |
| Build Tool | Vite 7 |
| Styling | Tailwind CSS 4 |
| UI Components | shadcn/ui + Radix UI |
| PDF Rendering | react-pdf |
| LaTeX Rendering | KaTeX |
| Animation | Framer Motion |
| Routing | Wouter |
| HTTP Client | Axios |
| Icons | Lucide React |

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** 18.0 or higher
- **pnpm** 8.0 or higher (recommended) or npm/yarn
- **OpenAI API Key** (optional, for AI features)

## Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/yezhuoyang/danmaku.git
   cd danmaku
   ```

2. **Install dependencies**:
   ```bash
   pnpm install
   ```

3. **Start the development server**:
   ```bash
   pnpm dev
   ```

4. **Open your browser** and navigate to `http://localhost:3000`

## Deployment

### Development Mode

```bash
pnpm dev
```

This starts the Vite development server with hot module replacement (HMR) enabled.

### Production Build

1. **Build the application**:
   ```bash
   pnpm build
   ```

2. **Preview the production build locally**:
   ```bash
   pnpm preview
   ```

3. **Start the production server**:
   ```bash
   pnpm start
   ```

### Environment Variables

For production deployment, you may configure the following environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | 3000 |
| `NODE_ENV` | Environment mode | development |

### Static Hosting

The built application can be deployed to any static hosting service:

1. Run `pnpm build`
2. Upload the contents of `dist/public/` to your hosting provider
3. Configure your server to serve `index.html` for all routes (SPA fallback)

**Supported platforms**: Vercel, Netlify, Cloudflare Pages, AWS S3 + CloudFront, GitHub Pages

## Testing

### Manual Testing

1. **Start the development server**:
   ```bash
   pnpm dev
   ```

2. **Navigate to the demo section** at `http://localhost:3000/#demo`

3. **Test annotation features**:
   - Click "Add Annotation" to enter annotation mode
   - Drag on the PDF to create a highlight region
   - Fill in the annotation details and save
   - Test drag-to-reposition by clicking the Move icon on annotations
   - Test delete functionality via the X button

4. **Test AI features**:
   - Click "AI Assistant" in the left panel
   - Click the settings gear icon
   - Enter your OpenAI API key
   - Select annotation types and click "Generate Annotations"
   - Review AI suggestions and click "Add" to apply them

### Type Checking

```bash
pnpm check
```

This runs TypeScript type checking without emitting files.

### Code Formatting

```bash
pnpm format
```

This formats all files using Prettier.

## API Reference

### AI Service API

The AI service (`client/src/lib/ai-service.ts`) provides a clean interface for AI integration:

```typescript
// Initialize the service
const aiService = new AIService();

// Configure API settings
aiService.configure({
  provider: 'openai',
  apiKey: 'sk-...',
  model: 'gpt-4o-mini',
  temperature: 0.3,
  maxTokens: 4096,
});

// Generate annotations with streaming
await aiService.generateAnnotationsStream(
  {
    paperContent: 'Full text of the paper...',
    pageTextContent: 'Text content of current page...',
    currentPage: 1,
    selectedTypes: ['equations', 'conclusions', 'methods'],
    existingAnnotations: [],
    language: 'auto',
    maxSuggestions: 5,
  },
  (chunk) => {
    switch (chunk.type) {
      case 'content':
        // Streaming content update
        break;
      case 'suggestion':
        // New annotation suggestion
        break;
      case 'error':
        // Error occurred
        break;
      case 'done':
        // Generation complete
        break;
    }
  }
);
```

### Annotation Data Structure

```typescript
interface Annotation {
  id: string;
  text: string;                    // Annotation content (supports LaTeX)
  user: string;                    // User who created the annotation
  timestamp: Date;
  page: number;                    // PDF page number
  region: {
    x: number;                     // X position (percentage)
    y: number;                     // Y position (percentage)
    width: number;                 // Width (percentage)
    height: number;                // Height (percentage)
  };
  type: 'text' | 'figure' | 'table' | 'equation';
  color: string;                   // Hex color code
  label?: string;                  // Optional label
  bubbleOffset?: { x: number; y: number };  // Bubble position offset
}
```

## Configuration

### AI Provider Settings

The AI Companion supports OpenAI's API. Configure it through the settings panel:

| Setting | Description | Default |
|---------|-------------|---------|
| API Key | Your OpenAI API key | Required |
| Model | GPT model to use | gpt-4o-mini |
| Temperature | Response creativity (0-1) | 0.3 |
| Max Tokens | Maximum response length | 4096 |

### Supported Annotation Types

| Type | Description | Color |
|------|-------------|-------|
| Equations | Mathematical formulas and expressions | Blue |
| Conclusions | Key findings and takeaways | Green |
| Methods | Methodology and approach descriptions | Yellow |
| Definitions | Term definitions and explanations | Pink |
| Results | Experimental results and data | Cyan |
| Insights | Personal insights and observations | Purple |
| Questions | Questions for discussion | Orange |

## Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## Acknowledgments

- **"Attention Is All You Need"** paper by Vaswani et al. (2017) used as the demo PDF
- **react-pdf** for PDF rendering capabilities
- **KaTeX** for LaTeX rendering
- **shadcn/ui** for beautiful UI components
- **OpenAI** for AI-powered annotation generation

## Contact

For questions, issues, or feature requests, please open an issue on GitHub or contact the maintainers.

---

**Paper Danmaku** - Collaborative Research Annotation Platform
