# Catalog Input

Place the songs you want to fingerprint in this directory, then run:

```bash
bun run catalog:build
```

Supported audio formats:

- `.mp3`
- `.wav`
- `.flac`
- `.m4a`
- `.ogg`
- `.aac`
- `.aif`
- `.aiff`

## Optional manifest

You can create `data/catalog/manifest.json` if you want custom titles and artists.

Example:

```json
{
  "tracks": [
    {
      "file": "night-sky.mp3",
      "title": "Night Sky",
      "artist": "Example Ensemble",
      "album": "School Demo"
    }
  ]
}
```
