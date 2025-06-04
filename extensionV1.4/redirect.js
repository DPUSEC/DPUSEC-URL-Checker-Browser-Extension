function goToSite() {
  const params = new URLSearchParams(window.location.search);
  const originalUrl = params.get('url');

  if (originalUrl) {
      let url = new URL(originalUrl);

      // Eğer URL'de bypassWarning yoksa ekle
      if (!url.searchParams.has('bypassWarning')) {
          url.searchParams.append('bypassWarning', 'true');
      }

      // Siteye yönlendir
      window.location.href = url.toString();
  } else {
      alert("URL bulunamadı.");
  }
}

document.querySelector(".go-to-site").addEventListener("click", goToSite);
