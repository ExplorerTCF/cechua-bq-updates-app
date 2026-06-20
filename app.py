import os
import re
import urllib.request
import xml.etree.ElementTree as ET
from html.parser import HTMLParser
from flask import Flask, render_template, jsonify

app = Flask(__name__)

# Cache for parsed release notes
# Format: {"last_updated": str, "items": [...]}
cache = {
    "last_updated": None,
    "items": []
}

class ReleaseNotesParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.items = []
        self.current_type = None
        self.current_html = []
        self.current_text = []
        self.in_h3 = False
        self.h3_text = []

    def handle_starttag(self, tag, attrs):
        if tag == 'h3':
            self.save_current_item()
            self.in_h3 = True
            self.h3_text = []
        else:
            attr_str = "".join([f' {k}="{v}"' for k, v in attrs])
            self.current_html.append(f"<{tag}{attr_str}>")

    def handle_endtag(self, tag):
        if tag == 'h3':
            self.in_h3 = False
            self.current_type = "".join(self.h3_text).strip()
        else:
            self.current_html.append(f"</{tag}>")

    def handle_data(self, data):
        if self.in_h3:
            self.h3_text.append(data)
        else:
            self.current_html.append(data)
            self.current_text.append(data)

    def save_current_item(self):
        # Only save if we actually collected something
        if self.current_html or self.current_text:
            html_content = "".join(self.current_html).strip()
            text_content = "".join(self.current_text).strip()
            text_content = " ".join(text_content.split())
            if html_content or text_content:
                self.items.append({
                    "type": self.current_type or "General",
                    "html": html_content,
                    "text": text_content
                })
        self.current_type = None
        self.current_html = []
        self.current_text = []

    def get_items(self):
        self.save_current_item()
        return self.items


def fetch_and_parse_feed():
    url = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"
    req = urllib.request.Request(
        url, 
        headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
    )
    
    with urllib.request.urlopen(req, timeout=15) as response:
        xml_data = response.read()
        
    root = ET.fromstring(xml_data)
    ns = "{http://www.w3.org/2005/Atom}"
    entries = root.findall(f"{ns}entry")
    
    parsed_items = []
    
    for entry in entries:
        title = entry.find(f"{ns}title").text
        updated = entry.find(f"{ns}updated").text
        link_elem = entry.find(f"{ns}link")
        link = link_elem.attrib.get("href") if link_elem is not None else "https://cloud.google.com/bigquery/docs/release-notes"
        content_elem = entry.find(f"{ns}content")
        content = content_elem.text if content_elem is not None else ""
        
        # Parse content into individual updates
        parser = ReleaseNotesParser()
        parser.feed(content)
        sub_items = parser.get_items()
        
        # Generate base ID for the entry
        entry_id = re.sub(r'[^a-zA-Z0-9]', '_', title)
        
        for idx, sub_item in enumerate(sub_items):
            parsed_items.append({
                "id": f"{entry_id}_{idx}",
                "date": title,
                "updated_raw": updated,
                "link": link,
                "type": sub_item["type"],
                "html": sub_item["html"],
                "text": sub_item["text"]
            })
            
    return parsed_items


def get_releases(force_refresh=False):
    global cache
    if force_refresh or not cache["items"]:
        try:
            items = fetch_and_parse_feed()
            cache["items"] = items
            from datetime import datetime
            cache["last_updated"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        except Exception as e:
            # If fetch fails and we have cached items, we keep them and log the error
            if not cache["items"]:
                raise e
    return cache


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/releases")
def api_releases():
    try:
        data = get_releases(force_refresh=False)
        return jsonify({
            "status": "success",
            "last_updated": data["last_updated"],
            "items": data["items"]
        })
    except Exception as e:
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500


@app.route("/api/refresh")
def api_refresh():
    try:
        data = get_releases(force_refresh=True)
        return jsonify({
            "status": "success",
            "last_updated": data["last_updated"],
            "items": data["items"]
        })
    except Exception as e:
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)
