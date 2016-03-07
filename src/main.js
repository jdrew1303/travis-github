// Determine the repository namespace
var repoPath = window.location.pathname.split("/").slice(1, 3).join("/");

function formatBuildItem(repoPath, item) {
  // Generate build url
  item.build_url = "https://travis-ci.org/" + repoPath + "/builds/" + item.id;

  // Do not include multi-line messages in the list
  item.message = item.message.split("\n")[0];

  // Determine outcome of the build
  item.success = parseInt(item.result) == 0;

  // Set css class for the icons
  item.css_class = "text-pending";

  // Set extra attributes when build is finished
  if (item.state == "finished") {
    item.finished = true;
    item.duration = moment.utc(moment(item.finished_at).diff(moment(item.started_at))).format("m [minutes and] s [seconds]");
    item.finished_at_string = moment(item.finished_at).fromNow();
    item.css_class = item.success ? "text-success" : "text-failure";
  }
  else {
    if (item.started_at) {
      item.started_at_string = moment(item.started_at).fromNow();
    }
  }

  return item;
}

function hasBuilds(cb) {
  var key = "travis/" + repoPath;
  var exists = localStorage.getItem(key);

  // Do not make any extra API calls if we already made a call
  if (exists !== null) {
    return cb(exists == "1");
  }

  $.ajax({
    url: "https://api.travis-ci.org/repos/" + repoPath + ".json",
    success: function() {
      localStorage.setItem(key, "1");
      cb(true);
    },
    error: function(resp) {
      if (resp.status == 404) localStorage.setItem(key, "0");
      cb(false);
    }
  });
}

function injectBuildsLink() {
  // Do not inject if not on repository page
  if ($(".repository-content").length == 0) return;

  // Do not reinject the link if it's still on the page
  if ($(".show-builds").length > 0) return;

  hasBuilds(function(result) {
    // No not inject link if project does not have builds
    if (!result) return;

    var linkHtml = Mustache.render(linkTemplate);
    var navLinks = $(".reponav span[itemprop='itemListElement']");

    // Add "builds" link after the "code" tab link
    $(linkHtml).insertAfter(navLinks[0]);
  });
}

$(function() {
  // Automatically inject the builds link
  injectBuildsLink();

  // Reinject the builds tab link when user switched between repository tabs
  $(document).on("pjax:complete", injectBuildsLink);

  $("body").on("click", ".show-builds", function(e) {
    e.preventDefault();

    // Show progress loader
    $(".page-context-loader").show();

    // Unselect any active nav links
    $(".reponav a.reponav-item").removeClass("selected");

    // Make our own tab link active
    $(this).addClass("selected");
    
    var viewUrl = "https://travis-ci.org/" + repoPath;
    var travisUrl = "https://api.travis-ci.org/repos/" + repoPath + "/builds";
    var builds = [];

    // Fetch builds data from Travis API
    // Pull requests are skipped since there's already PR tab
    $.getJSON(travisUrl, { event_type: "push" }, function(resp) {
      // Done loading
      $(".page-context-loader").hide();

      // Refarmat builds for the view
      for (i in resp) {
        builds.push(formatBuildItem(repoPath, resp[i]))
      }

      // Render builds list
      var view = Mustache.render(buildTemplate, {
        viewUrl: viewUrl,
        builds: builds
      });

      // Render builds tab content
      var output = Mustache.render(tabTemplate, {
        hasBuilds: builds.length > 0,
        view: view,
        viewUrl: viewUrl
      });

      $(".repository-content").html(output);
    });
  });
});