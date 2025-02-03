# React Component Tracker

A tool for scanning JSX, TSX, JS, and TS files to extract React component instances along with their line numbers. This utility helps you quickly locate where and how React components are used across your codebase.

## Overview

The **React Component Tracker** recursively traverses a specified directory, filters for source files (with extensions such as `.js`, `.ts`, `.jsx`, and `.tsx`), and extracts React component instances. A React component is identified by a JSX tag that starts with an uppercase letter. For each instance, the tool records:
- **Line number:** Where the component instance is found.
- **Line content:** The actual line of code (trimmed) containing the component.

It also supports custom ignore patterns (using wildcard syntax) so you can exclude certain files or directories from the scan.

## Features

- **Recursive Scanning:** Searches through all subdirectories of the specified root.
- **File Filtering:** Only processes files with the relevant extensions.
- **Ignore Patterns:** Supports wildcard patterns to skip files/directories (e.g., `node_modules/*`).
- **Component Extraction:** Detects and records React component instances with line numbers.
- **Unit Tests:** Includes tests for the core functions to ensure reliability.
- **TypeScript:** Written in TypeScript for improved type safety and maintainability.

## Installation

### Prerequisites

- **Node.js** (version 14 or higher)
- **npm** (comes with Node.js)

### Steps

1. **Clone the repository:**

   ```bash
   git clone https://github.com/freddymercury/react-component-tracker.git
   cd react-component-tracker
