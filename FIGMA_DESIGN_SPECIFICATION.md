# BeyondAsk - Figma Design System Specification

## Design Tokens

### Color Palette
```css
/* Primary Colors */
--color-primary: #6D6AFF
--color-primary-dark: #5957CC
--color-primary-light: #8B89FF

/* Secondary & Accent */
--color-secondary: #FF4BCB (HSL: 317 100% 64.7%)
--color-accent: #E5E7EB (HSL: 228 5% 96%)
--color-highlight: #FFB800

/* Background & Surfaces */
--color-background: #FAFBFF (HSL: 230 75% 98.4%)
--color-surface-light: #FFFFFF
--color-surface-medium: #F0F2FA

/* Text Colors */
--color-text-primary: #2D3748 (HSL: 240 25.4% 23.1%)
--color-text-secondary: #718096 (HSL: 235 14% 50%)

/* Status Colors */
--color-success: #10B981
--color-warning: #FBBF24
--color-error: #EF4444
--color-border: #E5E7EB

/* Chat Widget Colors */
--chat-primary-color: #3498DB
--chat-text-color: #FFFFFF
--chat-background-color: #FFFFFF
```

### Typography Scale
```css
/* Font Family */
font-family: 'Inter', system-ui, -apple-system, sans-serif

/* Font Sizes */
text-xs: 12px
text-sm: 14px
text-base: 16px
text-lg: 18px
text-xl: 20px
text-2xl: 24px
text-3xl: 30px
text-4xl: 36px

/* Font Weights */
font-normal: 400
font-medium: 500
font-semibold: 600
font-bold: 700

/* Line Heights */
leading-tight: 1.25
leading-normal: 1.5
leading-relaxed: 1.625
```

### Spacing System
```css
/* Spacing Scale (Tailwind) */
0.5: 2px
1: 4px
1.5: 6px
2: 8px
2.5: 10px
3: 12px
3.5: 14px
4: 16px
5: 20px
6: 24px
7: 28px
8: 32px
10: 40px
12: 48px
16: 64px
20: 80px
24: 96px

/* Border Radius */
--radius: 0.5rem (8px)
rounded-sm: 2px
rounded: 4px
rounded-md: 6px
rounded-lg: 8px
rounded-xl: 12px
rounded-2xl: 16px
```

## Component Library

### Button Components

#### Primary Button
```
Size: height 40px (h-10)
Padding: 16px horizontal, 8px vertical (px-4 py-2)
Background: #6D6AFF
Text: White, 14px, medium weight
Border Radius: 8px
States:
- Hover: #5957CC + translate-y-[-2px] + shadow-md
- Active: Pressed state
- Disabled: 50% opacity
```

#### Secondary Button
```
Size: height 40px (h-10)
Padding: 16px horizontal, 8px vertical (px-4 py-2)
Background: #FF4BCB
Text: White, 14px, medium weight
Border Radius: 8px
States: Same hover/active patterns
```

#### Button Sizes
```
Small: h-9 (36px), px-3 py-1.5, text-sm
Default: h-10 (40px), px-4 py-2, text-base
Large: h-12 (48px), px-8 py-3, text-lg
Icon: h-10 w-10 (40x40px)
```

### Card Components

#### Standard Card
```
Background: #FFFFFF
Border: 1px solid #E5E7EB
Border Radius: 8px
Padding: 24px (p-6)
Shadow: subtle drop shadow
```

#### Knowledge Base Card
```
Background: #FFFFFF
Border: 1px solid #E5E7EB
Border Radius: 8px
Padding: 16px (p-4)
Header: Icon + Title + Menu dots
Content: Document count + Description
Footer: Action buttons (View, Edit, Share)
```

### Form Components

#### Input Field
```
Height: 40px (h-10)
Padding: 12px horizontal (px-3)
Border: 1px solid #E5E7EB
Border Radius: 6px
Background: #FFFFFF
Font: 14px Inter
States:
- Focus: #6D6AFF border + ring
- Error: #EF4444 border
- Disabled: #F0F2FA background
```

#### Select Dropdown
```
Height: 40px (h-10)
Padding: 12px horizontal (px-3)
Border: 1px solid #E5E7EB
Border Radius: 6px
Arrow: Down chevron icon
```

### Navigation Components

#### Sidebar
```
Width: 256px (w-64)
Background: #FFFFFF
Border Right: 1px solid #E5E7EB
Padding: 16px (p-4)
Logo Area: 48px height
Navigation Items: 40px height each
```

#### Navbar
```
Height: 64px (h-16)
Background: #FFFFFF
Border Bottom: 1px solid #E5E7EB
Padding: 0 24px (px-6)
Logo: Left aligned
Actions: Right aligned (Profile, Settings)
```

### Icon System

#### Icon Sizes
```
Small: 16x16px (h-4 w-4)
Medium: 24x24px (h-6 w-6) - Default
Large: 32x32px (h-8 w-8)
Extra Large: 48x48px (h-12 w-12)
```

#### Common Icons (Lucide React)
```
Navigation: Menu, Home, Settings, User
Actions: Plus, Edit, Trash, MoreVertical
Content: FileText, Database, MessageSquare
Status: Check, X, AlertCircle, Info
```

## Screen Layouts

### 1. Dashboard Layout
```
Grid: 12 columns
Sidebar: 3 columns (256px)
Main Content: 9 columns
Header: Full width, 64px height
Content Padding: 24px all sides

Stats Cards Grid: 4 columns
Card Size: Height 120px
Gap: 24px between cards
```

### 2. Knowledge Base List
```
Header: 64px with title + actions
Search Bar: Full width, 40px height
Filter: Right aligned, 40px height
Card Grid: 3 columns on desktop, 1 on mobile
Card Size: Variable height, min 200px
Gap: 24px horizontal, 32px vertical
```

### 3. Visualizer Board (Workflow Builder)
```
Toolbar: Top, 48px height
Canvas: Full remaining height
Properties Panel: Right, 320px width (when open)
Grid: 20px snap grid
Node Sizes: 
- Chat Widget: 300x400px
- Knowledge Base: 200x150px
- Connectors: 4px stroke width
```

### 4. Agent Configuration
```
Form Layout: Single column, max-width 600px
Section Spacing: 32px between sections
Input Groups: 16px spacing
Label-Input Gap: 8px
Button Group: Right aligned, 16px gap
```

## Responsive Breakpoints

```css
/* Mobile First Approach */
sm: 640px   /* Small tablets */
md: 768px   /* Tablets */
lg: 1024px  /* Small desktops */
xl: 1280px  /* Large desktops */
2xl: 1536px /* Extra large screens */

/* Mobile Adaptations */
- Sidebar becomes overlay
- Card grid: 3→2→1 columns
- Padding reduces: 24px→16px→12px
- Font sizes scale down 1 step
```

## Component States

### Interactive States
```
Default: Base styling
Hover: Slight elevation + color shift
Active: Pressed visual feedback
Focus: Outline ring in primary color
Disabled: 50% opacity + no pointer events
Loading: Spinner + reduced opacity
```

### Status States
```
Success: Green (#10B981) accent
Warning: Yellow (#FBBF24) accent
Error: Red (#EF4444) accent
Info: Blue (#3498DB) accent
```

## Animation & Transitions

### Duration Scale
```
Fast: 150ms (hover effects)
Normal: 300ms (modal open/close)
Slow: 500ms (page transitions)
```

### Easing Functions
```
ease-in-out: Default for most animations
ease-out: For entrances
ease-in: For exits
```

### Common Animations
```
Hover Lift: transform: translateY(-2px)
Modal Enter: opacity + scale animation
Page Transition: slide + fade
Loading Spinner: rotate 360deg infinite
```

## Content Guidelines

### Text Hierarchy
```
Page Title: text-2xl, font-semibold
Section Header: text-xl, font-medium
Card Title: text-lg, font-medium
Body Text: text-base, font-normal
Caption: text-sm, text-secondary
Label: text-sm, font-medium
```

### Content Spacing
```
Page Title to Content: 32px
Section Header to Content: 24px
Paragraph Spacing: 16px
List Item Spacing: 8px
```

## Figma Implementation Guide

### 1. Setup Figma File
```
Create Pages:
- 🎨 Design System
- 📱 Mobile Screens
- 💻 Desktop Screens
- 🔄 User Flows
- 📋 Documentation
```

### 2. Create Design Tokens
```
Figma Variables:
- Colors: Create color variables for all design tokens
- Typography: Text styles for each font combination
- Spacing: Number variables for spacing scale
- Effects: Drop shadows and other effects
```

### 3. Build Component Library
```
Master Components:
- Button (with variants for size/type)
- Card (with different content types)
- Input (with different states)
- Navigation (sidebar/navbar)
- Icons (consistent sizing)
```

### 4. Create Screen Templates
```
Layout Grids:
- 12-column desktop grid
- Mobile single column
- Consistent margins and gutters
```

### 5. Prototype Interactions
```
Key Flows:
- Dashboard to Knowledge Bases
- Knowledge Base detail view
- Workflow builder interactions
- Agent configuration flow
- Team management flow
```

## Export Instructions

### For Development Handoff
```
Assets to Export:
- Logo (SVG format)
- Icons (SVG sprites)
- Component specs (CSS/React props)
- Color palette (CSS variables)
- Typography scale (CSS classes)
```

### Design Tokens Export
```json
{
  "colors": {
    "primary": "#6D6AFF",
    "secondary": "#FF4BCB",
    "background": "#FAFBFF"
  },
  "spacing": {
    "xs": "4px",
    "sm": "8px",
    "md": "16px",
    "lg": "24px",
    "xl": "32px"
  },
  "typography": {
    "base": "16px",
    "lineHeight": "1.5",
    "fontFamily": "Inter"
  }
}
```

This specification provides everything needed to recreate your BeyondAsk design system in Figma with pixel-perfect accuracy and consistent component behavior.