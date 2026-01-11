<?php session_start();
require('../dbconnect.php');
require('../islogin.php');
?>
<!DOCTYPE html>
<html lang="ja" class="" data-bs-theme="light">

<head>
    <meta charset="UTF-8" />
    <meta http-equiv="content-language" content="ja">
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="robots" content="noindex">
    <meta http-equiv="Cache-Control" content="no-cache">
    <link rel="apple-touch-icon" href="https://fromtheasia.com/wp-content/uploads/NCG162-2-140x140.jpg">
    <title>解答表示</title>
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.2.0-beta1/dist/js/bootstrap.bundle.min.js" integrity="sha384-pprn3073KE6tl6bjs2QrFaJGz5/SUsLqktiwsUTF55Jfv3qYSDhgCecCxMW52nD2" crossorigin="anonymous"></script>
    <link rel="stylesheet" href="../css/bootstrap.css" crossorigin="anonymous">
    <link rel="stylesheet" href="../css/style.css" />
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.7.1/font/bootstrap-icons.css">
    <script src="https://ajax.googleapis.com/ajax/libs/jquery/3.4.1/jquery.min.js"></script>
    <script src="js/cast.js"></script>
    <script src="../js/tool.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <script>
        document.addEventListener("dblclick", function (e) {
            e.preventDefault();
        }, {
            passive: false
        });
    </script>
    <script>
        $(function () {
            //スクロール
            $('#pagetop').click(function () {
                //id名#pagetopがクリックされたら、以下の処理を実行
                $("html,body").animate({
                    scrollTop: 0
                }, 0, 200);
            });
            $('#pagebottom').click(function () {
                //id名#pagetopがクリックされたら、以下の処理を実行
                $("html,body").animate({
                    scrollTop: $(document).height()
                }, 0, 200);
            });
        });
    </script>
    <script src="https://ajax.googleapis.com/ajax/libs/jquery/1.11.1/jquery.min.js"></script>
    <script>
        $(function () {
            var h = $(window).height();

            $('#wrap').css('display', 'none');
            $('#loader-bg ,#loader-light,#loader-dark').height(h).css('display', 'block');
        });

        $(window).load(function () { //全ての読み込みが完了したら実行
            $('#loader-bg').delay(200).fadeOut(200);
            $('#loader-light', '#loader-dark').delay(200).fadeOut(200);
            $('#wrap').css('display', 'block');
        });
    </script>
    <script>
        (function () {
            const savedTheme = localStorage.getItem('shikimel_tools_theme');
            if (savedTheme) {
                const theme = JSON.parse(savedTheme);
                document.documentElement.setAttribute('data-bs-theme', theme);
            }
        })();
    </script>
</head>

<body data-theme class="d-flex flex-column touch-none">

    <?php require('../component/loading.php'); ?>
    <?php require('../component/header.php'); ?>

    <main class="flex-shrink-0">
        <div id="Content" class="container-fluid bg-body" style="margin-bottom: 67px!important;">
            <div class="row my-2">

                <div class="col-12 mx-auto">
                    <span class="border-bottom h1 d-block py-2 mb-2 touch-none">解答表示</span>
                </div>
                <div class="col-12 mx-auto">

                    <div class="table-responsive">
                        <table class="table table-bordered fs-1 table-hover">
                            <thead class="border-secondary-subtle table-active">
                                <tr class="border-bottom border-2">
                                    <th class="position-sticky top-0 text-center" scope="col" style="width:10%;">#</th>
                                    <th class="position-sticky top-0 text-center" scope="col" style="width:10%;">Pts</th>
                                    <th class="position-sticky top-0 text-center" scope="col" style="width:15%;">問題番号</th>
                                    <th class="position-sticky top-0 text-center" scope="col" style="width:10%;">店舗</th>
                                    <th class="position-sticky top-0 text-center" scope="col" style="width:25%;">名前</th>
                                    <!--<th class="position-sticky top-0 text-center" scope="col" style="width:25%;">解答</th>-->
                                    <th class="position-sticky top-0 text-center" scope="col" style="width:25%;">解答スピード</th>
                                </tr>
                            </thead>
                            <tbody id="data" class="table-group-divider">
                            </tbody>
                        </table>
                    </div>

                </div>
            </div>

        </div>

        <?php require('../component/pagetopbutton.php'); ?>
        <?php require('../component/footer.php'); ?>
        <?php require('../component/accountmenu.php'); ?>

    </main>

</body>

</html>
