import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

// Get or create category by name
async function getOrCreateCategory(categoryName, site) {
  // Defensive: If categoryName is array or object, extract first string value
  if (Array.isArray(categoryName)) {
    categoryName = categoryName[0] || '';
  } else if (typeof categoryName === 'object' && categoryName !== null) {
    categoryName = Object.values(categoryName)[0] || '';
  }
  if (typeof categoryName !== 'string') categoryName = '';
  categoryName = categoryName.trim();

  const { url, username, password } = site;
  const auth = Buffer.from(`${username}:${password}`).toString('base64');
  try {
    const searchRes = await axios.get(`${url}/wp-json/wp/v2/categories`, {
      headers: { 'Authorization': `Basic ${auth}` },
      params: { search: categoryName }
    });
    if (searchRes.data.length > 0) {
      return searchRes.data[0].id;
    }
    const createRes = await axios.post(`${url}/wp-json/wp/v2/categories`, {
      name: categoryName
    }, {
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json'
      }
    });
    return createRes.data.id;
  } catch (err) {
    console.error(`Error getting/creating category "${categoryName}":`, err.response?.data || err.message);
    return null;
  }
}

// Main publishing function
export async function publishToWordPress(blog, site) {
  const { url, username, password } = site;
  const auth = Buffer.from(`${username}:${password}`).toString('base64');
  const { title, excerpt, tags = [], featuredImage, sections, conclusion } = blog;

  // Extract the single, normalized category string
  let category = blog.category;
  if (!category && blog.categories) {
    // Fallback for legacy: if categories is array, take first string
    if (Array.isArray(blog.categories)) {
      category = blog.categories[0];
    } else if (typeof blog.categories === 'string') {
      category = blog.categories;
    }
  }
  if (typeof category !== 'string') category = '';
  category = category.trim();

  const contentHTML = sections.map(s =>
    `<h2>${s.heading}</h2><p>${s.body}</p>` + (s.image ? `<img src="${s.image}" alt="${s.heading}"/>` : '')
  ).join('') + `<h2>Conclusion</h2><p>${conclusion}</p>`;

  const imageId = featuredImage ? await uploadImage(featuredImage, site) : null;

  const tagIds = await Promise.all(tags.map(tag => getOrCreateTag(tag, site)));
  const validTagIds = tagIds.filter(id => id !== null);

  // Always use a single, normalized category
  let categoryId = null;
  if (category) {
    categoryId = await getOrCreateCategory(category, site);
  }
  const validCategoryIds = categoryId ? [categoryId] : [];

  try {
    const postRes = await axios.post(`${url}/wp-json/wp/v2/posts`, {
      title,
      content: contentHTML,
      excerpt,
      status: 'publish',
      tags: validTagIds,
      categories: validCategoryIds,
      featured_media: imageId || undefined
    }, {
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json'
      }
    });
    console.log("post Response:", postRes.data);
    return postRes.data;
  } catch (err) {
    console.error('Error publishing post:', err.response?.data || err.message);
    throw err;
  }
}
