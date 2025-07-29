# API Documentation

The Homelab Dashboard uses a simple JavaScript API for managing services and configuration.

## Core Functions

### Service Management

#### `saveService()`
Saves a new service or updates an existing one.

```javascript
// Add new service
dashboard.serviceForm = {
  name: "Plex",
  url: "http://plex.local:32400",
  icon: "fas fa-play",
  category: "Media",
  description: "Media Server"
};
dashboard.saveService();
```

#### `deleteService(service)`
Removes a service from the dashboard.

```javascript
dashboard.deleteService(serviceObject);
```

#### `editService(service)`
Opens the edit modal for a specific service.

```javascript
dashboard.editService(serviceObject);
```

### Configuration Management

#### `exportConfig()`
Downloads the current configuration as a JSON file.

```javascript
dashboard.exportConfig();
```

#### `importConfig(event)`
Imports configuration from a JSON file upload.

```javascript
// Used with file input change event
dashboard.importConfig(fileInputEvent);
```

#### `resetData()`
Clears all stored data and reloads the page.

```javascript
dashboard.resetData(); // Shows confirmation dialog
```

### UI Helpers

#### `toggleCategory(categoryName)`
Toggles the collapsed state of a category section.

```javascript
dashboard.toggleCategory("Media");
```

#### `updateGridColumns()`
Updates the CSS grid columns variable.

```javascript
dashboard.gridColumns = 3;
dashboard.updateGridColumns();
```

## Data Structure

### Service Object
```javascript
{
  name: "String",        // Display name
  url: "String",         // Service URL
  icon: "String",        // FontAwesome class or image URL
  category: "String",    // Category for grouping
  description: "String"  // Brief description
}
```

### Configuration Object
```javascript
{
  services: [Service],           // Array of service objects
  collapsedCategories: [String], // Array of collapsed category names
  gridColumns: Number           // Number of grid columns (2-6)
}
```

## Local Storage

The dashboard uses `localStorage` with the key `homedash-config` to persist data.

### Reading Configuration
```javascript
const config = JSON.parse(localStorage.getItem('homedash-config'));
```

### Writing Configuration
```javascript
const config = {
  services: services,
  collapsedCategories: collapsedCategories,
  gridColumns: gridColumns
};
localStorage.setItem('homedash-config', JSON.stringify(config));
```

## Event Handling

### Keyboard Shortcuts
- `Ctrl+K`: Focus search input
- `Escape`: Close modals and context menus

### Context Menu Events
- `contextmenu`: Right-click on service cards to show context menu
- `click.away`: Click outside context menu to hide it

### Modal Events
- `click.self`: Click outside modal to close it
- `submit.prevent`: Form submission handling

## CSS Custom Properties

The dashboard uses CSS custom properties for theming:

```css
:root {
  --primary-color: #2563eb;
  --secondary-color: #64748b;
  --background-color: #0f172a;
  --surface-color: #1e293b;
  --text-primary: #f8fafc;
  --text-secondary: #cbd5e1;
  --border-color: #334155;
  --accent-color: #3b82f6;
  --grid-columns: 4;
  --card-gap: 1.5rem;
  --border-radius: 0.75rem;
}
```

## Alpine.js Directives Used

- `x-data`: Component data
- `x-init`: Initialization
- `x-show`: Conditional display
- `x-text`: Text binding
- `x-model`: Two-way binding
- `x-for`: List rendering
- `x-if`: Conditional rendering
- `@click`: Click events
- `@contextmenu`: Right-click events
- `@keydown`: Keyboard events
