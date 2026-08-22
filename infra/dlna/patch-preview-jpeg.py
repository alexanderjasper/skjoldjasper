"""Serve Immich's preview JPEG for stills whose original format renderers cannot
decode (HEIC/HEIF/AVIF/RAW). Upstream advertises the original file and its real
mime type, so an iPhone HEIC reaches the TV as undecodable bytes.

Applied at image build time. Asserts on the upstream text so an
IMMICH_DLNA_VERSION bump fails the build instead of silently dropping the patch.
"""

import pathlib

target = pathlib.Path("/app/src/immich_dlna/dlna/catalog.py")
source = target.read_text()

old = """            resource_url=f"{self.settings.base_url}/media/asset/{asset.asset_id}",
            thumbnail_url=f"{self.settings.base_url}/media/asset/{asset.asset_id}/thumbnail",
            mime_type=asset.original_mime_type or "application/octet-stream","""

new = """            resource_url=_resource_url_for(self.settings.base_url, asset),
            thumbnail_url=f"{self.settings.base_url}/media/asset/{asset.asset_id}/thumbnail",
            mime_type=_mime_type_for(asset),"""

helpers = '''

# Formats a DLNA renderer can be expected to decode natively. Anything else is
# served as Immich's preview JPEG instead of the original.
_RENDERABLE_IMAGE_MIMES = frozenset(
    {"image/jpeg", "image/jpg", "image/png", "image/gif", "image/bmp"}
)


def _serve_preview(asset) -> bool:
    if asset.is_video:
        return False
    return (asset.original_mime_type or "") not in _RENDERABLE_IMAGE_MIMES


def _resource_url_for(base_url: str, asset) -> str:
    url = f"{base_url}/media/asset/{asset.asset_id}"
    return f"{url}/thumbnail" if _serve_preview(asset) else url


def _mime_type_for(asset) -> str:
    if _serve_preview(asset):
        return "image/jpeg"
    return asset.original_mime_type or "application/octet-stream"
'''

assert source.count(old) == 1, "upstream catalog.py changed; re-check the patch"
assert "_RENDERABLE_IMAGE_MIMES" not in source, "patch already applied"

target.write_text(source.replace(old, new) + helpers)
print("patched", target)
