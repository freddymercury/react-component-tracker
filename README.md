# React Component Tracker

**React Component Tracker** is a command-line tool written in TypeScript that scans a directory (and its subdirectories) for JavaScript/TypeScript files containing JSX. It extracts instances of React components—by matching JSX tags that start with an uppercase letter—along with the line number, the line content, and the associated import statement from the top of the file.

## Features

- **Recursive File Scanning:**  
  Traverses a given directory to locate files with the extensions: `.js`, `.ts`, `.jsx`, and `.tsx`.

- **Component Extraction:**  
  Parses each file to find JSX component instances. For each component instance found, it prints:
  - The file name.
  - The component name.
  - The line number and content of the instance.
  - The corresponding import statement from which the component is imported.

- **Ignore Patterns:**  
  Supports comma-separated wildcard patterns (e.g., `**/node_modules/**, **/jest*, *test*, **/dist/**`) to exclude files or directories from being scanned.

- **Pure Functions & Unit Tests:**  
  Built with pure functions to improve testability and maintainability. The tool includes unit tests to verify the functionality of file scanning, import extraction, component detection, and ignore pattern filtering.

## Installation

1. **Clone the repository:**

   ```bash
   git clone https://github.com/freddymercury/react-component-tracker.git
   cd react-component-tracker


## Sample Output

```
> react-component-tracker@1.0.0 start
> ts-node index.ts ../eliza/client **/node_modules/**, **/jest*, *test*, **/dist/**

File: ../eliza/client/src/App.tsx
React Component Instances:
  Component: QueryClientProvider
    Line 24: <QueryClientProvider client={queryClient}>
      imported from import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
  Component: BrowserRouter
    Line 31: <BrowserRouter>
      imported from import { BrowserRouter, Route, Routes } from "react-router";
  Component: TooltipProvider
    Line 32: <TooltipProvider delayDuration={0}>
      imported from import { TooltipProvider } from "./components/ui/tooltip";
  Component: SidebarProvider
    Line 33: <SidebarProvider>
      imported from import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
  Component: AppSidebar
    Line 34: <AppSidebar />
      imported from import { AppSidebar } from "./components/app-sidebar";
  Component: SidebarInset
    Line 35: <SidebarInset>
      imported from import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
  Component: Routes
...
--------------------
Scanned Files: [
  '../eliza/client/eslint.config.js',
  '../eliza/client/postcss.config.js',
  '../eliza/client/src/App.tsx',
  '../eliza/client/src/components/app-sidebar.tsx',
  '../eliza/client/src/components/array-input.tsx',
```
