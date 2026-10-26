# Offline pipeline tools

These Python scripts were copied from the read-only kit. They are not part of the deployed app runtime.
`src/data/kit/kit-sync.json` retains the original upstream fingerprints.

`local-patches.json` records reviewed local Python fixes with both the upstream and patched SHA-256
and a reason. The kit boundary test checks both hashes; it does not exempt data, handbook text or assets.
Hash text with CRLF folded to LF, matching `scripts/sync-kit.mjs`.

The sync script continues to report these scripts as `local edit, skipped`. It must not overwrite
reviewed patches or silently mark them as original upstream copies. When upstream changes, compare
the patch, update this record deliberately, and rerun the kit and sync tests.

The current patches close file/image handles and remove one unused import from the CodeQL review.
The upstream kit itself has not been edited.
