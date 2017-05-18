const SERVER_URL = 'http://140.112.18.193:8787/';
let a_id = '';

function loadEvents(events) {
    events.forEach(function(element) {
        switch(element) {
            case 'register':
                loadRegisterEvents();
                break;
            case 'login':
                loadLoginEvents();
                break;
            case 'wallet':
                loadWalletEvents();
                break;
            default:
                break;
        }
    }, this);
}

function loadRegisterEvents() {
    $('.register-form .message a').click(function() {
        switchMode('login')
    });

    $('.form .register-form').submit(function(event) {
        console.log("submit register");
        event.preventDefault();
        a_id = $(".register-a_id").val();
        const passwd = $(".register-passwd").val();
        if ( a_id === "" ) {
            alert("You need to specify account ID");
        }
        else if ( passwd === "" ) {
            alert("You need to specify password");
        }
        else {
            $('.loader').show(500);
            $.get( "create/", { a_id, passwd } )
            .done(function( data ) {
                console.log("" + data);
                $('.loader').hide(500);
                if (JSON.parse(data).Success === true) {
                    alert( "Successfully create account, you can login now!" );
                    switchMode('login');
                }
                else {
                    alert( "Register error: " + data );
                    $(".register-a_id").val('');
                    $(".register-passwd").val('');
                }
            });
        }
    });
}

function loadLoginEvents() {
    $('.login-form .message a').click(function() {
        switchMode('register');
    });

    $('.form .login-form').submit(function(event) {
        console.log("submit login");
        event.preventDefault();
        a_id = $(".login-a_id").val();
        const passwd = $(".login-passwd").val();
        if ( a_id === "" ) {
            alert("You need to specify account ID");
        }
        else if ( passwd === "" ) {
            alert("You need to specify password");
        }
        else {
            $('.loader').show(500);
            $.get( "login/", { a_id, passwd } )
            .done(function( data ) {
                console.log("" + data);
                $('.loader').hide(500);
                if (JSON.parse(data).Success === true) {
                    localStorage.a_id = a_id;
                    setTimeout(() => {
                        window.location = SERVER_URL + 'wallet.html';
                    }, 200);
                }
                else {
                    alert( "Login error: " + data );
                    $(".login-a_id").val('');
                    $(".login-passwd").val('');
                }
            });
        }
    });
}

function loadWalletEvents() {
    a_id = localStorage.a_id || '';
    console.log("a_id: " + a_id);
    $(".wallet-title").text(a_id);

    getBalance();

    $('.wallet-nav ul .info-tab').click(function() {
        switchTab('info');
    });
    $('.wallet-nav ul .transfer-tab').click(function() {
        switchTab('transfer');
    });
    $('.wallet-nav ul .logout-tab').click(function() {
        switchTab('logout');
    });
    $('#wallet-content-refresh-btn').click(function() {
        getBalance();
    });
    $('#wallet-content-logout-btn').click(function() {
        logout();
    });

    $('.wallet-content-transfer-form').submit(function(event) {
        console.log("submit transfer");
        event.preventDefault();
        const to_id = $("#transfer-toid").val();
        const amount = parseFloat($("#transfer-amount").val());
        if ( to_id === "" ) {
            alert("You need to specify receiver ID");
        }
        else if ( !amount ) {
            alert("You need to specify amount");
        }
        else {
            $('.loader').show(500);
            $.get( "transfer/", { a_id, to_id, amount } )
            .done(function( data ) {
                console.log("" + data);
                $('.loader').hide(500);
                if (JSON.parse(data).Success === true) {
                    getBalance();
                    alert( "Successfully transfer!" );
                }
                else {
                    alert( "Error occurred during transfer: " + data );
                }
                $("#transfer-toid").val('');
                $("#transfer-amount").val('');
            });
        }
    });
}

function getBalance() {
    $('.loader').show(500);
    $.get( "check-balance/", { a_id } )
        .done(function( data ) {
            console.log("" + data);
            $('.loader').hide(500);
            dataObj = JSON.parse(data);
            if (dataObj.Success === true) {
                $("#wallet-info-aid").text(a_id);
                $("#wallet-info-balance").text(dataObj.Balance + ' eth');
            }
            else {
                alert( "Error: cannot query balance" );
            }
        });
}

function switchMode(mode) {
    if (mode === 'login') {
        console.log("Change to login mode");
        $('.form .register-form').hide(500);
        $('.form .login-form').show(500);
    } else {
        console.log("Change to register mode");
        $('.form .login-form').hide(500);
        $('.form .register-form').show(500);
    }
}

function switchTab(tab) {
    if (tab === 'info') {
        console.log("Change to info tab");
        $('.wallet-content-info').show(500);
        $('.wallet-content-transfer').hide(500);
        $('.wallet-content-logout').hide(500);
    } else  if (tab === 'transfer') {
        console.log("Change to transfer tab");
        $('.wallet-content-info').hide(500);
        $('.wallet-content-transfer').show(500);
        $('.wallet-content-logout').hide(500);
    } else {
        console.log("Change to logout tab");
        $('.wallet-content-info').hide(500);
        $('.wallet-content-transfer').hide(500);
        $('.wallet-content-logout').show(500);
    }
}

function logout() {
    $('.loader').show(500);
    $.get( "logout/", { a_id } )
        .done(function( data ) {
            console.log("" + data);
            $('.loader').hide(500);
            dataObj = JSON.parse(data);
            if (dataObj.Success === true || dataObj.Err === 'Account has not logged-in') {
                window.location = SERVER_URL + 'login.html';
            }
            else {
                alert( "Error occurred when logout" );
            }
        });
}