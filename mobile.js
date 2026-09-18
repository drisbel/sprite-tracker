let selectedUserId = null;

let sessionToken =
  localStorage.getItem(
    'spriteSessionToken'
  );

let appData = null;

let masteredMap = {};

let currentTab =
  'locker';

const tradeSelections =
  {};



// ==================================================
// START
// ==================================================

window.addEventListener(
  'load',
  initialiseApp
);


function initialiseApp() {

  if (
    sessionToken
  ) {
    loadApp();
  } else {
    loadLogin();
  }

}



// ==================================================
// SERVER
// ==================================================

function serverCall(
  successHandler,
  functionName,
  ...args
) {

  google.script.run
    .withSuccessHandler(
      successHandler
    )
    .withFailureHandler(
      handleError
    )
    [functionName](
      ...args
    );

}



// ==================================================
// LOGIN
// ==================================================

function loadLogin() {

  document
    .getElementById(
      'loadingScreen'
    )
    .classList.add(
      'hidden'
    );

  document
    .getElementById(
      'appScreen'
    )
    .classList.add(
      'hidden'
    );

  document
    .getElementById(
      'loginScreen'
    )
    .classList.remove(
      'hidden'
    );
document
    .getElementById(
      'userButtons'
    )
    .classList.remove(
      'hidden'
    );

  selectedUserId =
    null;

  serverCall(
    renderUsers,
    'getPublicUsers'
  );

}


function renderUsers(users) {

  const container =
    document.getElementById(
      'userButtons'
    );

  container.innerHTML =
    '';


  users.forEach(
    user => {

      const button =
        document.createElement(
          'button'
        );


      button.textContent =
        user.DisplayName;


      button.onclick =
        () =>
          selectUser(
            user
          );


      container.appendChild(
        button
      );

    }
  );

}


function selectUser(user) {

  selectedUserId =
    user.UserID;

  serverCall(
    handleLoginSuccess,
    'login',
    selectedUserId
  );

}


function handleLoginSuccess(
  result
) {

  sessionToken =
    result.token;


  localStorage.setItem(
    'spriteSessionToken',
    sessionToken
  );


  currentTab =
    'locker';


  loadApp();

}



// ==================================================
// APP DATA
// ==================================================

function loadApp() {

  serverCall(
    handleAppData,
    'getAppData',
    sessionToken
  );

}


function handleAppData(data) {

  appData =
    data;

        loadSpriteAdminMeta_();


  document
    .getElementById(
      'loadingScreen'
    )
    .classList.add(
      'hidden'
    );


  document
    .getElementById(
      'loginScreen'
    )
    .classList.add(
      'hidden'
    );


  document
    .getElementById(
      'appScreen'
    )
    .classList.remove(
      'hidden'
    );


  document
    .getElementById(
      'adminTabButton'
    )
    .classList.toggle(
      'hidden',
      !appData.currentUser.adminEligible
    );


  renderLocker();

  renderAdmin();

  showTab(
    currentTab
  );


  loadMasteredState_();

}



// ==================================================
// REFRESH
// ==================================================

function refreshApp() {

  const button =
    document.getElementById(
      'refreshButton'
    );


  button.disabled =
    true;


  button.textContent =
    '↻ REFRESHING...';


  google.script.run
    .withSuccessHandler(
      data => {

        appData =
          data;

        loadSpriteAdminMeta_();


        renderLocker();

        renderAdmin();

        loadMasteredState_();


        if (
          currentTab ===
          'collections'
        ) {
          renderCollections();
        }


        if (
          currentTab ===
          'matches'
        ) {
          loadTradeMatches();
        }


        if (
          currentTab ===
          'trades'
        ) {
          loadMyTrades();
        }


        button.textContent =
          '✓';


        setTimeout(
          () => {

            button.disabled =
              false;

            button.textContent =
              '↻';

          },
          800
        );

      }
    )
    .withFailureHandler(
      error => {

        button.disabled =
          false;

        button.textContent =
          '↻';

        handleError(
          error
        );

      }
    )
    .getAppData(
      sessionToken
    );

}



// ==================================================
// HELPERS
// ==================================================

function getCollection_(
  userId,
  spriteId
) {

  return appData.collections.find(
    row =>
      row.UserID ===
        userId &&
      row.SpriteID ===
        spriteId
  );

}


function owns_(
  userId,
  spriteId,
  variantId
) {

  const row =
    getCollection_(
      userId,
      spriteId
    );


  return Boolean(
    row &&
    row.Owned &&
    row.Owned[
      variantId
    ]
  );

}


// ==================================================
// MASTERED
// ==================================================

function masteredKey_(
  spriteId,
  variantId
) {
  return String(spriteId) + '::' + String(variantId);
}


function isMastered_(
  spriteId,
  variantId
) {
  return Boolean(
    masteredMap[
      masteredKey_(
        spriteId,
        variantId
      )
    ]
  );
}


function loadMasteredState_() {

  if (!sessionToken) {
    masteredMap = {};
    return;
  }

  serverCall(

    items => {

      masteredMap = {};

      (items || []).forEach(
        item => {
          masteredMap[
            masteredKey_(
              item.SpriteID,
              item.VariantID
            )
          ] = true;
        }
      );

      if (appData) {
        renderLocker();

        if (
          currentTab ===
          'collections'
        ) {
          renderCollections();
        }
      }

    },

    'getMasteredItems',
    sessionToken

  );

}


function variantExists_(
  sprite,
  variantId
) {

  return Boolean(
    sprite &&
    sprite.Available &&
    sprite.Available[
      variantId
    ]
  );

}


function getSpriteImage_(
  sprite,
  variantId
) {

  return (
    sprite.Images[
      variantId
    ] || ''
  );

}


function variantName_(
  variantId
) {

  const variant =
    appData.variants.find(
      item =>
        item.VariantID ===
        variantId
    );


  return variant
    ? variant.VariantName
    : variantId;

}




// ==================================================
// SPRITE ADMIN META / UNRELEASED
// ==================================================
function variantIsUnreleased_(sprite, variantId) {
  return Boolean(sprite && sprite.Unreleased && sprite.Unreleased[variantId]);
}

function applySpriteAdminMeta_(meta) {
  if (!appData) return;
  const unreleased = (meta && meta.unreleased) || {};
  appData.sprites.forEach(sprite => {
    sprite.Unreleased = {};
    appData.variants.forEach(variant => {
      sprite.Unreleased[variant.VariantID] =
        Boolean(unreleased[sprite.SpriteID + '|' + variant.VariantID]);
    });
  });
}

function loadSpriteAdminMeta_() {
  if (!appData || !sessionToken) return;
  serverCall(
    meta => {
      applySpriteAdminMeta_(meta);
      renderLocker();
      if (currentTab === 'collections') renderCollections();
      if (currentTab === 'matches') loadTradeMatches();
      if (currentTab === 'admin') renderAdmin();
    },
    'getSpriteAdminMeta',
    sessionToken
  );
}

function adminSetUnreleased() {
  const scope = document.getElementById('adminReleaseScope').value;
  const spriteId = document.getElementById('adminReleaseSprite').value;
  const variantId = document.getElementById('adminReleaseVariant').value;
  const unreleased =
    document.getElementById('adminReleaseState').value === 'unreleased';

  serverCall(
    result => {
      alert(result.updated + ' sprite variant(s) updated.');
      refreshApp();
    },
    'setUnreleasedStatus',
    sessionToken,
    scope,
    spriteId,
    variantId,
    unreleased
  );
}

function adminRenameSprite() {
  const spriteId = document.getElementById('adminRenameSprite').value;
  const newName = document.getElementById('adminRenameName').value.trim();
  if (!newName) {
    alert('Enter a new sprite name.');
    return;
  }
  serverCall(
    result => {
      alert('Renamed to ' + result.SpriteName + '.');
      document.getElementById('adminRenameName').value = '';
      refreshApp();
    },
    'renameSprite',
    sessionToken,
    spriteId,
    newName
  );
}

function renderAdminOrder_() {
  const container = document.getElementById('adminSpriteOrderList');
  if (!container || !appData) return;

  container.innerHTML = appData.sprites.map((sprite, index) => `
    <div class="admin-order-row">
      <div class="admin-order-number">${index + 1}</div>
      <div class="admin-order-name">${escapeHtml(sprite.SpriteName)}</div>
      <button type="button" class="admin-order-button"
        onclick="adminMoveSprite('${escapeJs(sprite.SpriteID)}', -1)"
        ${index === 0 ? 'disabled' : ''}>↑</button>
      <button type="button" class="admin-order-button"
        onclick="adminMoveSprite('${escapeJs(sprite.SpriteID)}', 1)"
        ${index === appData.sprites.length - 1 ? 'disabled' : ''}>↓</button>
    </div>
  `).join('');
}

function adminMoveSprite(spriteId, direction) {
  const ids = appData.sprites.map(sprite => sprite.SpriteID);
  const index = ids.indexOf(spriteId);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= ids.length) return;
  [ids[index], ids[target]] = [ids[target], ids[index]];

  serverCall(
    () => refreshApp(),
    'reorderSprites',
    sessionToken,
    ids
  );
}

function populateExtraAdminControls_() {
  if (!appData || !appData.currentUser.isAdmin) return;

  const spriteOptions = appData.sprites.map(sprite =>
    `<option value="${escapeHtml(sprite.SpriteID)}">${escapeHtml(sprite.SpriteName)}</option>`
  ).join('');

  const variantOptions = appData.variants.map(variant =>
    `<option value="${escapeHtml(variant.VariantID)}">${escapeHtml(variant.VariantName)}</option>`
  ).join('');

  ['adminReleaseSprite', 'adminRenameSprite'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const old = el.value;
    el.innerHTML = spriteOptions;
    if (Array.from(el.options).some(o => o.value === old)) el.value = old;
  });

  const variant = document.getElementById('adminReleaseVariant');
  if (variant) {
    const old = variant.value;
    variant.innerHTML = variantOptions;
    if (Array.from(variant.options).some(o => o.value === old)) variant.value = old;
  }

  renderAdminOrder_();
}


// ==================================================
// DYNAMIC TABLE
// ==================================================

function tableTemplate_() {

  return (
    'minmax(150px, 1.45fr) ' +
    `repeat(${appData.variants.length}, minmax(95px, 1fr))`
  );

}


function tableMinimumWidth_() {

  return (
    180 +
    appData.variants.length *
    115
  ) + 'px';

}



// ==================================================
// VARIANT PROGRESS
// ==================================================

function renderVariantProgress_() {

  const container =
    document.getElementById(
      'variantProgress'
    );


  if (!container) {
    return;
  }


  container.innerHTML =
    appData.variants
      .map(
        variant => {

          let available =
            0;

          let owned =
            0;

          let mastered =
            0;


          appData.sprites.forEach(
            sprite => {

              if (
                !variantExists_(
                  sprite,
                  variant.VariantID
                ) ||
            variantIsUnreleased_(sprite, variant.VariantID)
              ) {
                return;
              }


              available++;


              if (
                owns_(
                  appData.currentUser.userId,
                  sprite.SpriteID,
                  variant.VariantID
                )
              ) {
                owned++;


                if (
                  isMastered_(
                    sprite.SpriteID,
                    variant.VariantID
                  )
                ) {
                  mastered++;
                }
              }

            }
          );


          const percent =
            available
              ? Math.round(
                  owned /
                  available *
                  100
                )
              : 0;


          return `

            <div class="variant-progress-card">

              <div class="variant-progress-name">
                ${escapeHtml(
                  variant.VariantName.toUpperCase()
                )}
              </div>

              <div class="variant-progress-count">
                ${owned} / ${available}
              </div>

              <div class="variant-progress-percent">
                ${percent}%
              </div>

              <div class="variant-progress-mastered">
                ★ ${mastered} MASTERED
              </div>

            </div>

          `;

        }
      )
      .join('');

}



// ==================================================
// LOCKER
// ==================================================

function renderLocker() {

  if (!appData) {
    return;
  }


  let total = 0;
  let owned = 0;
  let mastered = 0;


  appData.sprites.forEach(
    sprite => {

      appData.variants.forEach(
        variant => {

          if (
            !variantExists_(
              sprite,
              variant.VariantID
            ) ||
            variantIsUnreleased_(sprite, variant.VariantID)
          ) {
            return;
          }


          total++;


          if (
            owns_(
              appData.currentUser.userId,
              sprite.SpriteID,
              variant.VariantID
            )
          ) {
            owned++;


            if (
              isMastered_(
                sprite.SpriteID,
                variant.VariantID
              )
            ) {
              mastered++;
            }
          }

        }
      );

    }
  );


  const percentage =
    total
      ? Math.round(
          owned / total * 100
        )
      : 0;


  document
    .getElementById(
      'playerName'
    )
    .textContent =
    appData
      .currentUser
      .displayName
      .toUpperCase() +
    "'S COLLECTION";


  document
    .getElementById(
      'progressText'
    )
    .textContent =
    owned +
    ' / ' +
    total +
    ' collected • ★ ' +
    mastered +
    ' mastered';


  document
    .getElementById(
      'percentageText'
    )
    .textContent =
    percentage +
    '%';


  document
    .getElementById(
      'progressFill'
    )
    .style.width =
    percentage +
    '%';


  renderVariantProgress_();


  const container =
    document.getElementById(
      'spriteList'
    );


  container.innerHTML =
    appData.sprites
      .map(
        sprite => {

          const availableVariants =
            appData.variants.filter(
              variant =>
                variantExists_(
                  sprite,
                  variant.VariantID
                )
            );


          if (
            !availableVariants.length
          ) {
            return '';
          }


          const collectedCount =
            availableVariants.filter(
              variant =>
                owns_(
                  appData.currentUser.userId,
                  sprite.SpriteID,
                  variant.VariantID
                )
            ).length;


          const masteredCount =
            availableVariants.filter(
              variant =>
                owns_(
                  appData.currentUser.userId,
                  sprite.SpriteID,
                  variant.VariantID
                ) &&
                isMastered_(
                  sprite.SpriteID,
                  variant.VariantID
                )
            ).length;


          const cards =
            availableVariants
              .map(
                variant =>
                  createMobileLockerCard_(
                    sprite,
                    variant
                  )
              )
              .join('');


          return `

            <section class="mobile-locker-sprite-section">

              <div class="mobile-locker-sprite-heading">

                <div class="mobile-locker-sprite-title">
                  ${escapeHtml(
                    sprite.SpriteName.toUpperCase()
                  )}
                </div>

                <div class="mobile-locker-sprite-total">
                  ${collectedCount}/${availableVariants.length}
                  • ★ ${masteredCount}
                </div>

              </div>

              <div class="mobile-locker-grid">
                ${cards}
              </div>

            </section>

          `;

        }
      )
      .join('');

}



function createMobileLockerCard_(
  sprite,
  variant
) {

  if (variantIsUnreleased_(sprite, variant.VariantID)) {
    return `
      <div class="mobile-locker-card unreleased">
        <div class="mobile-locker-image-wrap">
          <img src="${escapeHtml(getSpriteImage_(sprite, variant.VariantID))}"
               class="mobile-locker-image" loading="lazy">
          <div class="mobile-unreleased-badge">UNRELEASED</div>
        </div>
        <div class="mobile-locker-name">${escapeHtml(variant.VariantName)}</div>
      </div>
    `;
  }


  const owned =
    owns_(
      appData.currentUser.userId,
      sprite.SpriteID,
      variant.VariantID
    );


  const mastered =
    owned &&
    isMastered_(
      sprite.SpriteID,
      variant.VariantID
    );


  const imageUrl =
    getSpriteImage_(
      sprite,
      variant.VariantID
    );


  const stateClass =
    mastered
      ? 'mastered'
      : owned
        ? 'owned'
        : 'locked';


  const statusIcon =
    mastered
      ? '★'
      : owned
        ? '✓'
        : '🔒';


  const stateLabel =
    mastered
      ? 'MASTERED'
      : owned
        ? 'COLLECTED'
        : 'MISSING';


  return `

    <button
      type="button"
      class="mobile-locker-card ${stateClass}"
      onclick="toggleSprite(
        '${escapeJs(sprite.SpriteID)}',
        '${escapeJs(variant.VariantID)}'
      )"
      aria-label="${escapeHtml(
        sprite.SpriteName +
        ' ' +
        variant.VariantName +
        ' — ' +
        stateLabel
      )}"
    >

      <div class="mobile-locker-image-wrap">

        <img
          src="${escapeHtml(imageUrl)}"
          class="mobile-locker-image"
          loading="lazy"
        >

        <div class="mobile-locker-status">
          ${statusIcon}
        </div>

        ${
          mastered
            ? `
              <div class="mobile-locker-mastered-badge">
                MASTERED
              </div>
            `
            : ''
        }

      </div>

      <div class="mobile-locker-name">
        ${escapeHtml(variant.VariantName)}
      </div>

    </button>

  `;

}



// ==================================================
// TOGGLE COLLECTION
// ==================================================

function toggleSprite(
  spriteId,
  variantId
) {

  serverCall(

    result => {

      const row =
        getCollection_(
          appData.currentUser.userId,
          spriteId
        );


      if (row) {

        row.Owned[
          variantId
        ] =
          Boolean(
            result.owned
          );

      }


      const key =
        masteredKey_(
          spriteId,
          variantId
        );


      if (
        result.mastered
      ) {
        masteredMap[key] = true;
      } else {
        delete masteredMap[key];
      }


      renderLocker();


      if (
        currentTab ===
        'collections'
      ) {
        renderCollections();
      }

    },

    'cycleSpriteState',

    sessionToken,
    spriteId,
    variantId

  );

}



// ==================================================
// COLLECTIONS
// ==================================================

function renderCollections() {

  if (!appData) {
    return;
  }

  const container =
    document.getElementById(
      'groupSpriteList'
    );

  if (!container) {
    return;
  }

  let totalAvailable = 0;
  let groupOwned = 0;

  appData.sprites.forEach(sprite => {
    appData.variants.forEach(variant => {
      if (!variantExists_(sprite, variant.VariantID) ||
            variantIsUnreleased_(sprite, variant.VariantID)) {
        return;
      }

      totalAvailable++;

      if (
        appData.users.some(user =>
          owns_(
            user.UserID || user.userId,
            sprite.SpriteID,
            variant.VariantID
          )
        )
      ) {
        groupOwned++;
      }
    });
  });

  const groupOwnedCount =
    document.getElementById('groupOwnedCount');

  const groupPercentage =
    document.getElementById('groupPercentage');

  const missingEveryoneCount =
    document.getElementById('missingEveryoneCount');

  if (groupOwnedCount) {
    groupOwnedCount.textContent =
      groupOwned + ' / ' + totalAvailable;
  }

  if (groupPercentage) {
    groupPercentage.textContent =
      (
        totalAvailable
          ? Math.round(groupOwned / totalAvailable * 100)
          : 0
      ) + '%';
  }

  if (missingEveryoneCount) {
    missingEveryoneCount.textContent =
      totalAvailable - groupOwned;
  }

  container.innerHTML =
    appData.sprites
      .map(
        sprite => {

          const variants =
            appData.variants.filter(
              variant =>
                variantExists_(
                  sprite,
                  variant.VariantID
                )
            );

          if (!variants.length) {
            return '';
          }

          const found =
            variants.filter(
              variant =>
                appData.users.some(
                  user =>
                    owns_(
                      user.UserID || user.userId,
                      sprite.SpriteID,
                      variant.VariantID
                    )
                )
            ).length;

          return `

            <section class="mobile-collection-sprite-section">

              <div class="mobile-collection-sprite-heading">

                <div class="mobile-collection-sprite-title">
                  ${escapeHtml(
                    sprite.SpriteName.toUpperCase()
                  )}
                </div>

                <div class="mobile-collection-sprite-total">
                  ${found}/${variants.length} FOUND
                </div>

              </div>

              <div class="mobile-collection-grid">

                ${
                  variants
                    .map(
                      variant =>
                        createMobileCollectionCard_(
                          sprite,
                          variant
                        )
                    )
                    .join('')
                }

              </div>

            </section>

          `;

        }
      )
      .join('');

}


function createMobileCollectionCard_(
  sprite,
  variant
) {

  if (variantIsUnreleased_(sprite, variant.VariantID)) {
    return `
      <div class="mobile-collection-card unreleased">
        <div class="mobile-collection-image-wrap">
          <img src="${escapeHtml(getSpriteImage_(sprite, variant.VariantID))}"
               class="mobile-collection-image" loading="lazy">
          <div class="mobile-unreleased-badge">UNRELEASED</div>
        </div>
        <div class="mobile-collection-variant">${escapeHtml(variant.VariantName)}</div>
      </div>
    `;
  }


  const collectors =
    appData.users.filter(
      user =>
        owns_(
          user.UserID || user.userId,
          sprite.SpriteID,
          variant.VariantID
        )
    );

  const found =
    collectors.length > 0;

  const collectorNames =
    collectors
      .map(
        user =>
          user.DisplayName ||
          user.displayName ||
          ''
      )
      .filter(Boolean)
      .join(', ');

  return `

    <div
      class="mobile-collection-card ${
        found
          ? 'collected'
          : 'missing'
      }"
    >

      <div class="mobile-collection-image-wrap">

        <img
          src="${escapeHtml(
            getSpriteImage_(
              sprite,
              variant.VariantID
            )
          )}"
          class="mobile-collection-image"
          loading="lazy"
        >

        <div class="mobile-collection-status">
          ${found ? '✓' : '—'}
        </div>

      </div>

      <div class="mobile-collection-variant">
        ${escapeHtml(
          variant.VariantName
        )}
      </div>

      <div class="mobile-collection-collectors">
        ${escapeHtml(
          found
            ? collectorNames
            : 'Nobody'
        )}
      </div>

    </div>

  `;

}



// ==================================================
// TABS
// ==================================================

function showTab(tabName) {

  if (
    tabName === 'admin'
  ) {

    if (
      !appData ||
      !appData.currentUser.adminEligible
    ) {
      return;
    }

    if (
      !appData.currentUser.isAdmin
    ) {
      requestAdminUnlock_();
      return;
    }

  }


  currentTab =
    tabName;

  const mobileTitle =
    document.getElementById(
      'mobilePageTitle'
    );

  if (mobileTitle) {

    const titles = {
      locker: 'Locker',
      collections: 'Collections',
      matches: 'Find Trades',
      trades: 'My Trades',
      admin: 'Admin'
    };

    mobileTitle.textContent =
      titles[tabName] ||
      'Locker';

  }



  const ids = {

    locker:
      'lockerTab',

    collections:
      'collectionsTab',

    matches:
      'matchesTab',

    trades:
      'tradesTab',

    admin:
      'adminTab'

  };


  Object.values(ids)
    .forEach(
      id => {

        document
          .getElementById(id)
          .classList.add(
            'hidden'
          );

      }
    );


  document
    .getElementById(
      ids[tabName]
    )
    .classList.remove(
      'hidden'
    );


  const tabs =
    document
      .querySelectorAll(
        '#mainTabs .tab:not(.hidden)'
      );


  tabs.forEach(
    tab =>
      tab.classList.remove(
        'active'
      )
  );


  const target =
    Array.from(tabs)
      .find(
        tab =>
          tab
            .getAttribute(
              'onclick'
            )
            .includes(
              "'" +
              tabName +
              "'"
            )
      );


  if (target) {

    target.classList.add(
      'active'
    );

  }


  if (
    tabName ===
    'collections'
  ) {

    renderCollections();

  }


  if (
    tabName ===
    'matches'
  ) {

    loadTradeMatches();

  }


  if (
    tabName ===
    'trades'
  ) {

    loadMyTrades();

  }


  if (
    tabName ===
    'admin'
  ) {

    renderAdmin();

  }

}



// ==================================================
// ADMIN PIN
// ==================================================

function requestAdminUnlock_() {

  const pin =
    window.prompt(
      'Enter admin PIN'
    );

  if (
    pin === null
  ) {
    return;
  }

  if (
    !String(pin).trim()
  ) {
    alert(
      'Enter the admin PIN.'
    );
    return;
  }

  serverCall(
    () => {

      // Reload app data so the server-confirmed admin state
      // is reflected everywhere before opening the panel.
      serverCall(
        data => {

          appData =
            data;

          loadSpriteAdminMeta_();

          document
            .getElementById(
              'adminTabButton'
            )
            .classList.toggle(
              'hidden',
              !appData.currentUser.adminEligible
            );

          renderLocker();
          renderAdmin();
          showTab('admin');

        },
        'getAppData',
        sessionToken
      );

    },
    'unlockAdmin',
    sessionToken,
    String(pin).trim()
  );

}


// ==================================================
// ADMIN
// ==================================================

function renderAdmin() {

  if (
    !appData ||
    !appData.currentUser.isAdmin
  ) {
    return;
  }


  const newFields =
    document.getElementById(
      'adminNewSpriteImages'
    );


  newFields.innerHTML =
    appData.variants
      .map(
        variant => `

          <div class="admin-image-row">

            <small>
              ${escapeHtml(variant.VariantName)}
              IMAGE URL
            </small>

            <input
              id="newImage_${escapeHtml(variant.VariantID)}"
              class="admin-input"
              type="text"
              placeholder="Leave blank if this variant does not exist"
            >

          </div>

        `
      )
      .join('');


  const select =
    document.getElementById(
      'adminSpriteSelect'
    );


  const previous =
    select.value;


  select.innerHTML =
    appData.sprites
      .map(
        sprite => `

          <option
            value="${escapeHtml(sprite.SpriteID)}"
          >
            ${escapeHtml(sprite.SpriteName)}
          </option>

        `
      )
      .join('');


  if (
    appData.sprites.some(
      sprite =>
        sprite.SpriteID ===
        previous
    )
  ) {

    select.value =
      previous;

  }


  renderAdminExistingImages();
  populateExtraAdminControls_();

}


function renderAdminExistingImages() {

  if (
    !appData ||
    !appData.currentUser.isAdmin
  ) {
    return;
  }


  const spriteId =
    document
      .getElementById(
        'adminSpriteSelect'
      )
      .value;


  const sprite =
    appData.sprites.find(
      item =>
        item.SpriteID ===
        spriteId
    );


  const container =
    document.getElementById(
      'adminExistingImages'
    );


  if (!sprite) {

    container.innerHTML =
      '';

    return;

  }


  container.innerHTML =
    appData.variants
      .map(
        variant => `

          <div class="admin-image-row">

            <small>
              ${escapeHtml(variant.VariantName)}
              IMAGE URL
            </small>

            <input
              id="existingImage_${escapeHtml(variant.VariantID)}"
              class="admin-input"
              type="text"
              value="${escapeHtml(
                sprite.Images[
                  variant.VariantID
                ] || ''
              )}"
              placeholder="Blank = variant does not exist"
            >

          </div>

        `
      )
      .join('');

}


function adminAddSprite() {

  const name =
    document
      .getElementById(
        'adminSpriteName'
      )
      .value
      .trim();


  const rarity =
    document
      .getElementById(
        'adminSpriteRarity'
      )
      .value
      .trim();


  const images =
    {};


  appData.variants.forEach(
    variant => {

      images[
        variant.VariantID
      ] =
        document
          .getElementById(
            'newImage_' +
            variant.VariantID
          )
          .value
          .trim();

    }
  );


  serverCall(

    result => {

      alert(
        result.SpriteName +
        ' added.'
      );


      document
        .getElementById(
          'adminSpriteName'
        )
        .value =
        '';


      refreshApp();

    },

    'addSprite',

    sessionToken,
    name,
    rarity,
    images

  );

}


function adminAddVariant() {

  const name =
    document
      .getElementById(
        'adminVariantName'
      )
      .value
      .trim();


  if (!name) {

    alert(
      'Enter a variant name.'
    );

    return;

  }


  if (
    !confirm(
      'Add the new variant "' +
      name +
      '"?'
    )
  ) {
    return;
  }


  serverCall(

    result => {

      alert(
        result.VariantName +
        ' added.'
      );


      document
        .getElementById(
          'adminVariantName'
        )
        .value =
        '';


      refreshApp();

    },

    'addVariant',

    sessionToken,
    name

  );

}


function adminSaveSpriteImages() {

  const spriteId =
    document
      .getElementById(
        'adminSpriteSelect'
      )
      .value;


  const images =
    {};


  appData.variants.forEach(
    variant => {

      images[
        variant.VariantID
      ] =
        document
          .getElementById(
            'existingImage_' +
            variant.VariantID
          )
          .value
          .trim();

    }
  );


  serverCall(

    () => {

      alert(
        'Image URLs saved.'
      );

      refreshApp();

    },

    'updateSpriteImages',

    sessionToken,
    spriteId,
    images

  );

}



// ==================================================
// FIND TRADES
// ==================================================

function loadTradeMatches() {

  const container =
    document.getElementById(
      'tradeMatches'
    );


  container.innerHTML =
    '<div class="empty-message">Checking collections...</div>';


  serverCall(
    renderTradeMatches,
    'getTradeMatches',
    sessionToken
  );

}


function renderTradeMatches(matches) {

  const container =
    document.getElementById(
      'tradeMatches'
    );


  container.innerHTML =
    '';


  matches.forEach(
    match => {

      tradeSelections[
        match.user.UserID
      ] = {

        offered: [],
        requested: []

      };


      const card =
        document.createElement(
          'div'
        );


      card.className =
        'match-card';


      card.innerHTML = `

        <h3>
          ${escapeHtml(match.user.DisplayName)}
        </h3>

        <div class="match-columns">

          <div>

            <strong>
              THEY HAVE — YOU NEED
            </strong>

            ${
              match.theyHave.length
                ? match.theyHave
                    .map(
                      item =>
                        tradeOption_(
                          match.user.UserID,
                          'requested',
                          item
                        )
                    )
                    .join('')
                : '<div class="empty-message">Nothing</div>'
            }

          </div>

          <div>

            <strong>
              YOU HAVE — THEY NEED
            </strong>

            ${
              match.youHave.length
                ? match.youHave
                    .map(
                      item =>
                        tradeOption_(
                          match.user.UserID,
                          'offered',
                          item
                        )
                    )
                    .join('')
                : '<div class="empty-message">Nothing</div>'
            }

          </div>

        </div>

        <button
          id="sendTrade_${escapeHtml(match.user.UserID)}"
          class="send-trade-button"
          disabled
          onclick="submitTradeBuilder('${escapeJs(match.user.UserID)}')"
        >
          SEND
        </button>

      `;


      container.appendChild(
        card
      );

    }
  );

}


function tradeOption_(
  userId,
  type,
  item
) {

  return `

    <button
      type="button"
      class="selectable-trade-item"
      onclick="toggleTradeChoice_(
        '${escapeJs(userId)}',
        '${escapeJs(type)}',
        '${escapeJs(item.SpriteID)}',
        '${escapeJs(item.SpriteName)}',
        '${escapeJs(item.Variant)}',
        '${escapeJs(item.ImageURL)}',
        this
      )"
    >

      ${
        item.ImageURL
          ? `
            <img
              src="${escapeHtml(item.ImageURL)}"
              class="trade-match-image"
            >
          `
          : ''
      }

      <div class="trade-select-text">

        <div class="trade-item-name">
          ${escapeHtml(item.SpriteName)}
        </div>

        <div class="variant">
          ${escapeHtml(
            item.VariantName ||
            variantName_(
              item.Variant
            )
          )}
        </div>

      </div>

      <div class="trade-select-indicator">
        +
      </div>

    </button>

  `;

}


function toggleTradeChoice_(
  userId,
  type,
  spriteId,
  spriteName,
  variant,
  imageUrl,
  button
) {

  const list =
    tradeSelections[
      userId
    ][type];


  const index =
    list.findIndex(
      item =>
        item.SpriteID ===
          spriteId &&
        item.Variant ===
          variant
    );


  if (
    index >= 0
  ) {

    list.splice(
      index,
      1
    );

    button.classList.remove(
      'selected'
    );

  } else {

    list.push({

      SpriteID:
        spriteId,

      SpriteName:
        spriteName,

      Variant:
        variant,

      ImageURL:
        imageUrl

    });


    button.classList.add(
      'selected'
    );

  }


  const selection =
    tradeSelections[
      userId
    ];


  const send =
    document.getElementById(
      'sendTrade_' +
      userId
    );


  send.disabled =
    selection.offered.length === 0 &&
    selection.requested.length === 0;


  if (
    selection.offered.length &&
    selection.requested.length
  ) {

    send.textContent =
      'SUGGEST TRADE';

  } else if (
    selection.offered.length
  ) {

    send.textContent =
      'OFFER GIFT';

  } else if (
    selection.requested.length
  ) {

    send.textContent =
      'SEND REQUEST';

  } else {

    send.textContent =
      'SEND';

  }

}


function submitTradeBuilder(userId) {

  const selection =
    tradeSelections[
      userId
    ];


  if (!selection) {
    return;
  }


  if (
    !confirm(
      'Send this offer?'
    )
  ) {
    return;
  }


  serverCall(

    () => {

      alert(
        'Sent.'
      );

      loadTradeMatches();

    },

    'createTrade',

    sessionToken,
    userId,
    selection.offered,
    selection.requested

  );

}



// ==================================================
// MY TRADES
// ==================================================

function loadMyTrades() {

  const container =
    document.getElementById(
      'myTrades'
    );


  container.innerHTML =
    '<div class="empty-message">Loading trades...</div>';


  serverCall(

    result => {

      serverCall(

        clearedTradeIds => {

          const cleared =
            new Set(
              clearedTradeIds || []
            );

          result.trades =
            (result.trades || [])
              .filter(
                trade =>
                  !cleared.has(
                    trade.TradeID
                  )
              );

          renderMyTrades(
            result
          );

        },

        'getClearedTradeIds',
        sessionToken

      );

    },

    'getMyTrades',
    sessionToken

  );

}


function renderMyTrades(result) {

  const container =
    document.getElementById(
      'myTrades'
    );


  const trades =
    result.trades || [];


  if (!trades.length) {

    container.innerHTML =
      '<div class="empty-message">No trades yet.</div>';

    return;

  }


  container.innerHTML =
    trades
      .map(
        trade => {

          const incoming =
            trade.ToUserID ===
            result.currentUserId;


          let title;


          if (
            trade.OfferedItems.length &&
            trade.RequestedItems.length
          ) {

            title =
              incoming
                ? 'TRADE FROM ' +
                  trade.FromName
                : 'TRADE TO ' +
                  trade.ToName;

          } else if (
            trade.OfferedItems.length
          ) {

            title =
              incoming
                ? 'GIFT FROM ' +
                  trade.FromName
                : 'GIFT TO ' +
                  trade.ToName;

          } else {

            title =
              incoming
                ? 'REQUEST FROM ' +
                  trade.FromName
                : 'REQUEST TO ' +
                  trade.ToName;

          }


          let actionButtons =
            '';


          if (
            incoming &&
            trade.Status ===
              'Pending'
          ) {

            actionButtons += `

              <button
                onclick="respondTrade(
                  '${escapeJs(trade.TradeID)}',
                  'Accepted'
                )"
              >
                ACCEPT
              </button>

              <button
                class="secondary"
                onclick="respondTrade(
                  '${escapeJs(trade.TradeID)}',
                  'Declined'
                )"
              >
                DECLINE
              </button>

            `;

          }


          if (
            trade.Status ===
            'Accepted'
          ) {

            actionButtons += `

              <button
                class="complete-trade-button"
                onclick="completeTradeRequest(
                  '${escapeJs(trade.TradeID)}'
                )"
              >
                MARK COMPLETED
              </button>

            `;

          }


          actionButtons += `

            <button
              class="secondary clear-trade-button"
              onclick="clearTradeFromScreen(
                '${escapeJs(trade.TradeID)}'
              )"
            >
              CLEAR
            </button>

          `;


          const actions = `

            <div class="trade-actions">
              ${actionButtons}
            </div>

          `;

          return `

            <div class="match-card">

              <h3>
                ${escapeHtml(title)}
              </h3>

              <div
                class="trade-status ${escapeHtml(trade.Status.toLowerCase())}"
              >
                ${escapeHtml(trade.Status)}
              </div>

              <div class="match-columns">

                <div>

                  <strong>
                    OFFERED
                  </strong>

                  ${tradeItemsHtml_(
                    trade.OfferedItems
                  )}

                </div>

                <div>

                  <strong>
                    REQUESTED
                  </strong>

                  ${tradeItemsHtml_(
                    trade.RequestedItems
                  )}

                </div>

              </div>

              ${actions}

            </div>

          `;

        }
      )
      .join('');

}


function tradeItemsHtml_(items) {

  if (!items.length) {

    return '<div class="empty-message">Nothing</div>';

  }


  return items
    .map(
      item => `

        <div class="match-item trade-match-item">

          ${
            item.ImageURL
              ? `
                <img
                  src="${escapeHtml(item.ImageURL)}"
                  class="trade-match-image"
                >
              `
              : ''
          }

          <div>

            <div class="trade-item-name">
              ${escapeHtml(item.SpriteName)}
            </div>

            <div class="variant">
              ${escapeHtml(
                variantName_(
                  item.Variant
                )
              )}
            </div>

          </div>

        </div>

      `
    )
    .join('');

}


function respondTrade(
  tradeId,
  response
) {

  serverCall(

    () =>
      loadMyTrades(),

    'respondToTrade',

    sessionToken,
    tradeId,
    response

  );

}


function completeTradeRequest(
  tradeId
) {

  if (
    !confirm(
      'Mark this as completed?'
    )
  ) {
    return;
  }


  serverCall(

    () => {

      alert(
        'Completed.'
      );

      refreshApp();

    },

    'completeTrade',

    sessionToken,
    tradeId

  );

}



// ==================================================
// CLEAR TRADE FROM MY SCREEN
// ==================================================

function clearTradeFromScreen(
  tradeId
) {

  if (
    !confirm(
      'Clear this trade from your screen?\n\n' +
      'This only hides it for you. ' +
      'It does not cancel, decline or delete the trade for the other user.'
    )
  ) {
    return;
  }


  serverCall(

    () => {
      loadMyTrades();
    },

    'clearTradeForUser',

    sessionToken,
    tradeId

  );

}



// ==================================================
// LOGOUT
// ==================================================

function logoutApp() {

  const token =
    sessionToken;


  sessionToken =
    null;

  appData =
    null;


  localStorage.removeItem(
    'spriteSessionToken'
  );


  if (token) {

    google.script.run
      .withFailureHandler(
        () => {}
      )
      .logout(
        token
      );

  }


  loadLogin();

}



// ==================================================
// ERRORS
// ==================================================

function handleError(error) {

  console.error(
    error
  );


  const message =
    error &&
    error.message
      ? error.message
      : 'Something went wrong.';


  if (
    message
      .toLowerCase()
      .includes(
        'session'
      )
  ) {

    sessionToken =
      null;

    appData =
      null;

    localStorage.removeItem(
      'spriteSessionToken'
    );

    // Expired sessions now return quietly to profile selection.
    loadLogin();

    return;

  }


  alert(
    message
  );

}



// ==================================================
// ESCAPING
// ==================================================

function escapeHtml(value) {

  const div =
    document.createElement(
      'div'
    );


  div.textContent =
    String(
      value ?? ''
    );


  return div.innerHTML;

}


function escapeJs(value) {

  return String(
    value ?? ''
  )
    .replace(
      /\\/g,
      '\\\\'
    )
    .replace(
      /'/g,
      "\\'"
    )
    .replace(
      /\r/g,
      ''
    )
    .replace(
      /\n/g,
      '\\n'
    );

}