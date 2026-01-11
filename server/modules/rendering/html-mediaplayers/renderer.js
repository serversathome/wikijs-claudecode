/**
 * This file was modified by Claude Code
 * HTML Media Players Renderer - Converts oembed tags and video links to embedded players
 */

const defined = require('../../../app/regex')

// Extended YouTube regex that handles more URL formats
const rxYoutube = /^.*(?:(?:youtu\.be\/|v\/|vi\/|u\/\w\/|embed\/|shorts\/)|(?:(?:watch)?\?v(?:i)?=|&v(?:i)?=))([^#&?]*).*/

// Vimeo regex
const rxVimeo = /vimeo\.com\/(?:channels\/(?:\w+\/)?|groups\/(?:[^/]*)\/videos\/|album\/(?:\d+)\/video\/|)(\d+)(?:$|\/|\?)/

// Dailymotion regex
const rxDailymotion = /(?:dailymotion\.com(?:\/embed)?(?:\/video|\/hub)|dai\.ly)\/([0-9a-z]+)(?:[-_0-9a-zA-Z]+(?:#video=)?([a-z0-9]+)?)?/

// Screencast regex
const rxScreencast = /^.*(?:(?:https?:)?\/\/)?(?:www\.)?screencast\.com\/users\/([a-z0-9_-]+)\/folders\/([a-z0-9%_-]+)\/media\/([a-z0-9_-]+)(?:\/)?$/i

module.exports = {
  async init($, config) {
    // Process <oembed> tags (from CKEditor/WYSIWYG)
    $('oembed').each((idx, elm) => {
      const url = $(elm).attr('url')
      if (!url) return

      const embedHtml = generateEmbed(url)
      if (embedHtml) {
        $(elm).replaceWith(embedHtml)
      }
    })

    // Process <figure class="media"> tags (another CKEditor format)
    $('figure.media').each((idx, elm) => {
      const oembed = $(elm).find('oembed')
      if (oembed.length > 0) {
        const url = oembed.attr('url')
        if (url) {
          const embedHtml = generateEmbed(url)
          if (embedHtml) {
            $(elm).replaceWith(embedHtml)
          }
        }
      }
    })

    // Process standalone links that are video URLs
    $('a').each((idx, elm) => {
      const href = $(elm).attr('href')
      const text = $(elm).text().trim()

      // Only convert if the link text is the same as the URL (standalone video link)
      if (!href || !text) return
      if (text !== href && !text.includes('youtu') && !text.includes('vimeo')) return

      const embedHtml = generateEmbed(href)
      if (embedHtml) {
        // Check if parent is a paragraph with only this link
        const parent = $(elm).parent()
        if (parent.is('p') && parent.children().length === 1 && parent.text().trim() === text) {
          parent.replaceWith(embedHtml)
        }
      }
    })
  }
}

/**
 * Generate embed HTML for a given URL
 */
function generateEmbed(url) {
  if (!url) return null

  // YouTube
  const ytMatch = url.match(rxYoutube)
  if (ytMatch && ytMatch[1]) {
    return `<div class="responsive-embed">
      <iframe src="https://www.youtube-nocookie.com/embed/${ytMatch[1]}"
        frameborder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowfullscreen>
      </iframe>
    </div>`
  }

  // Vimeo
  const vimeoMatch = url.match(rxVimeo)
  if (vimeoMatch && vimeoMatch[1]) {
    return `<div class="responsive-embed">
      <iframe src="https://player.vimeo.com/video/${vimeoMatch[1]}"
        frameborder="0"
        allow="autoplay; fullscreen; picture-in-picture"
        allowfullscreen>
      </iframe>
    </div>`
  }

  // Dailymotion
  const dmMatch = url.match(rxDailymotion)
  if (dmMatch && dmMatch[1]) {
    return `<div class="responsive-embed">
      <iframe src="https://www.dailymotion.com/embed/video/${dmMatch[1]}"
        frameborder="0"
        allow="autoplay; fullscreen; picture-in-picture"
        allowfullscreen>
      </iframe>
    </div>`
  }

  // Screencast
  const scMatch = url.match(rxScreencast)
  if (scMatch) {
    return `<div class="responsive-embed">
      <iframe src="${url}/embed"
        frameborder="0"
        allowfullscreen>
      </iframe>
    </div>`
  }

  // MP4 video files
  if (url.endsWith('.mp4') || url.endsWith('.webm') || url.endsWith('.ogg')) {
    const type = url.endsWith('.mp4') ? 'video/mp4' : url.endsWith('.webm') ? 'video/webm' : 'video/ogg'
    return `<div class="responsive-embed">
      <video controls>
        <source src="${url}" type="${type}">
        Your browser does not support the video tag.
      </video>
    </div>`
  }

  return null
}
