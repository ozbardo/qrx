<div align=center>
  <div><img alt="Q for QRx" src="./public/favicon.png" width=96></div>
  <h1>Generative QR Coding (QRx)</h1>
  <p>QRx Kernel 26.02.15 (index.html)</p>
  <div><img alt="QR Code for QRx Kernel 26.02.15" src="./public/index.qr.png" width=400></div>
</div>
<br>

This qr encodes an html file turning any browser capable device since the 90s into an offline-first **ruliadic prism** that can help you do literally anything possible. It does this by reimagining the browser's local storage as a **regenerative file system** composed from **hyperlinks** that functions as a prompt chaining interface

If you open that qr in the browser and scan or click the rest of the **hyperlinks** in this document that back to it you, will end up with something like [**https://qrx.world**](https://qrx.world) 





-----------------------------





# Core flags
The above Kernel exposes the following URL `?query` params

| Flag | Description |
| :--- | :--- |
| **`a`** | **Append Mode**. If `1`, subsequent commands append to the accumulator. If `0` (default), they overwrite it. |
| **`f`** | **File Pointer**. Sets the target filename (`filename`) for subsequent write (`w`) operations. |
| **`c`** | **Context**. Loads data (from DB or `src`) into a side-buffer for the AI, without affecting the main accumulator. `0` clears it. |
| **`k, m, s, h`** | **AI Config**. Sets the API Key (`k`), Model (`m`), System Prompt (`s`), or Host (`h`) in `localStorage`. |
| **`e`** | **Echo**. Pushes the raw value directly into the accumulator (hardcoded strings/HTML). |
| **`r`** | **Read**. Reads a file from the database (or `src` for source code) into the accumulator. |
| **`u`** | **URL**. Fetches text from a remote URL and puts it into the accumulator. |
| **`p`** | **Prompt**. Sends the current context + accumulator + value to the LLM. The result becomes the new accumulator. |
| **`w`** | **Write**. Saves the current accumulator content to the database under the name defined by `f`. |
| **`x`** | **Execute**. Runs the value (or the current accumulator if value is empty) as JavaScript. |

# Globals
The kernel exposes the following variables and methods

## Variables
| Variable | Description |
| :--- | :--- |
| **`filename`** | **File Pointer**. The name of the current record being read from or written to. Defaults to `MAIN` or the value before `?` in the hash. |
| **`DB`** | **Database Name**. The name of the active IndexedDB instance, derived from the URL path (e.g., `/private` sets `DB` to `'private'`). |
| **`MAIN`** | **Kernel Name**. The default database name (`'main'`). Used as the fallback/system database when `DB` is set to something else. |
| **`os`** | **System DB Handle**. A reference to the `MAIN` database connection. Used for "inheritance"—if a file isn't found in `DB`, `read()` looks here. |
| **`db`** | **Active DB Handle**. The raw `IDBDatabase` connection object for the current `DB`. |
| **`FILES`** | **Table Name**. The hardcoded name of the object store (`'files'`) within the IndexedDB where all records are saved. |

## Methods
| Method | Description |
| :--- | :--- |
| **`read(k, [d])`** | **Async Read**. Returns the content of file `k`. Checks the current database first, then falls back to the `os` database if the file exists there. |
| **`write(v, [k])`** | **Async Write**. Saves value `v` to file `k`. If `k` is omitted, it defaults to the current `filename` pointer. |
| **`hydrate(h)`** | **Render**. Injects HTML string `h` into the main DOM (`<main id=A>`) and recursively executes any embedded `<script>` tags. |
| **`gen(ctx, p)`** | **Vibe Code**. Sends the context buffer `ctx` and prompt `p` to the configured LLM API and returns the generated text. |
| **`keys([q], [d])`** | **List Files**. Returns an array of all keys (filenames) in the database. `q` is an optional `IDBKeyRange`. |
| **`getDB([n])`** | **Database Access**. Returns the IndexedDB instance for name `n`. Defaults to the current active database. |
| **`run()`** | **Re-Run Tape**. Manually triggers the URL parsing loop. Useful if hash state changes programmatically without a reload. |
