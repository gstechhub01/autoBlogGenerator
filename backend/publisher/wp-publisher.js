import axios from 'axios';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Use require for JSON file
// const config = require('./blog-configs.json'); // Adjust the path if necessary

dotenv.config();

// Upload image helper
async function uploadImage(imageUrl, site) {
  const { url, username, password } = site;
  const auth = Buffer.from(`${username}:${password}`).toString('base64');
  const imageName = imageUrl.split('/').pop();
  const imageRes = await axios.get(imageUrl, { responseType: 'arraybuffer' });
  const imageBuffer = Buffer.from(imageRes.data, 'binary');

  const uploadRes = await axios.post(`${url}/wp-json/wp/v2/media`, imageBuffer, {
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Disposition': `attachment; filename="${imageName}"`,
      'Content-Type': 'image/jpeg'
    }
  });

  return uploadRes.data.id;
}

// Get or create tag by name
async function getOrCreateTag(tagName, site) {
  const { url, username, password } = site;
  const auth = Buffer.from(`${username}:${password}`).toString('base64');
  try {
    const searchRes = await axios.get(`${url}/wp-json/wp/v2/tags`, {
      headers: { 'Authorization': `Basic ${auth}` },
      params: { search: tagName }
    });

    if (searchRes.data.length > 0) {
      return searchRes.data[0].id;
    }

    const createRes = await axios.post(`${url}/wp-json/wp/v2/tags`, {
      name: tagName
    }, {
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json'
      }
    });

    return createRes.data.id;

  } catch (err) {
    console.error(`Error getting/creating tag "${tagName}":`, err.response?.data || err.message);
    return null;
  }
}

// Main publishing function
export async function publishToWordPress(blog, site) {
  const { url, username, password } = site;
  const auth = Buffer.from(`${username}:${password}`).toString('base64');
  const { title, excerpt, tags = [], featuredImage, sections, conclusion } = blog;

  const contentHTML = sections.map(s =>
    `<h2>${s.heading}</h2><p>${s.body}</p>` + (s.image ? `<img src="${s.image}" alt="${s.heading}"/>` : '')
  ).join('') + `<h2>Conclusion</h2><p>${conclusion}</p>`;

  const imageId = featuredImage ? await uploadImage(featuredImage, site) : null;

  const tagIds = await Promise.all(tags.map(tag => getOrCreateTag(tag, site)));
  const validTagIds = tagIds.filter(id => id !== null);

  try {
    const postRes = await axios.post(`${url}/wp-json/wp/v2/posts`, {
      title,
      content: contentHTML,
      excerpt,
      status: 'publish',
      tags: validTagIds,
      featured_media: imageId || undefined
    }, {
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json'
      }
    });
    console.log("post Response:", postRes.data);
    // Do NOT update blog-configs.json here. Let the controller handle it.
    return postRes.data;
  } catch (err) {
    console.error('Error publishing post:', err.response?.data || err.message);
    throw err;
  }
}
