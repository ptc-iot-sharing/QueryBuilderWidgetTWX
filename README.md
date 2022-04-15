# Advanced Query Builder widget
This is an advanced query builder allowing to build much more complex queries compared to the OOTB filter widget.
Supports complex conditions, deep nesting, AND/OR conditions and more.

It is based on the [jQuery QueryBuilder](https://querybuilder.js.org/) library.

## Usage
Similar to the filter widget, it expects a infotable with the datashape definiton. This can vary at runtime. 
The widget then generates a query expression.

## Building and publishing

The following commands allow you to build and compile your widget:

* `npm run build`: builds the extension. Creates a new extension zip file under the `zip` folder.
* `npm run watch`: watches the source files, and whenever they change, do a build
* `npm run upload`: creates a build, and uploads the extension zip to the thingworx server configured in `package.json`.

##This Extension is provided as-is and without warranty or support. It is not part of the PTC product suite. This project is licensed under the terms of the MIT license
