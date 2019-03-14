// ==UserScript==
// @name         bangumi图片上传
// @namespace    https://github.com/shadowdreamer/jioben
// @version      0.2
// @description 上传图片到niupic，catbox,管理历史上传记录
// @author       dovahkiin
// @include      http*://bgm.tv*
// @include      http*://bangumi.tv*
// @grant        GM_xmlhttpRequest
// @require      https://cdn.bootcss.com/vue/2.6.8/vue.min.js
// ==/UserScript==

(function () {
    const box = document.createElement("div");
    document.body.append(box);
    box.innerHTML = `
    <div id="imgupload">
    <div class="openUpload imgupload-toggle" @click="open = !open">upload</div>
    <div class="openHistory imgupload-toggle" @click="openHistory = !openHistory">history</div>
    <transition name="warp">
        <div class="imgupload-warp upload-layout" v-show="open">
            <p>{{message}}</p>
            <span>选择上传网站：</span>
            <select  v-model="uploadApi" >
                <option value="niupic">niupic</option>
                <option value="catbox">Catbox</option>
                <option value="sm.ms">sm.ms</option>
            </select>

            <div
                class = "drop-area"
                contenteditable="true"
                @dragenter.stop.prevent = " dropArea = '' "
                @dragover.stop.prevent
                @drop.stop.prevent = "dodrop($event)"
                @paste.stop.prevent = "pasteEvt($event)"
                >
                <p v-for="notice in notices">{{notice}}</p>

            </div>

            <input
                type="file"
                multiple="multiple"
                :files = "file"
                accept="image/gif, image/jpeg, image/jpg, image/png"
                @change="change($event)"
            >
            <input type="button" value="上传" @click="pushToUpload"/>
            &nbsp;&nbsp;&nbsp;&nbsp;
            <input type="button" value="清空" @click="file = null"/>


            <div class="url-box"  v-for="(imgurl,index) in url"  :key = "index">
                <input :value="imgurl | addWithTag" :id="'img-url-' + index" readonly>
                <input type="button" value="点击复制" @click="copyToClipboard('img-url-' + index)">
            </div>



        </div>
    </transition>
    <transition name="warp">
        <div class="imgupload-warp history-layout" v-show="openHistory">
            <ul>
                <li v-for="(url,index) in urlList" :key="index" class = "img-history-list">
                    <img :src="url | addHttp">
                    <button @click="deleteThisImg(index)" >删除</button>
                </li>
            </ul>
        </div>
    </transition>
</div>`

    new Vue({
        el: "#imgupload",
        data() {
            return {
                message: "上传文件:",
                file: null,
                url: [],
                uploading: false,
                open: false,
                openHistory: false,
                urlList: [],
                uploadApi: 'niupic',
            };
        },
        computed: {
            notices() {
                let notice = [];
                if (!this.file) {
                    return ['拖动或者粘贴文件到此处', '只能粘贴剪贴板图片(如qq截图)', '支持多个文件']
                } else {
                    function renderSize(value) {
                        if (!value) {
                            return "0 Bytes";
                        }
                        var unitArr = new Array("Bytes", "KB", "MB", "GB", "TB");
                        var index = 0;
                        var srcsize = parseFloat(value);
                        index = Math.floor(Math.log(srcsize) / Math.log(1024));
                        var size = srcsize / Math.pow(1024, index);
                        size = size.toFixed(2);//保留的小数位数
                        return size + unitArr[index];
                    }
                    Array.prototype.forEach.call(this.file, el => {
                        notice.push(el.name + ',' + renderSize(el.size))
                    })
                }
                return notice
            }
        },
        methods: {
            pushToUpload() {
                if (!this.file) return;
                this.url = Array.from({ length: this.file.length }, () => '')
                Array.prototype.forEach.call(this.file, (el, index) => {
                    this.upload(el, index)
                })
            },
            upload(file, index) {
                const formData = new FormData();
                let api = "";
                switch (this.uploadApi) {
                    case "niupic":
                        api = "https://www.niupic.com/api/upload";
                        formData.append("image_field", file);
                        break;
                    case "catbox":
                        api = "https://catbox.moe/user/api.php";
                        formData.append("fileToUpload", file)
                        formData.append("reqtype", "fileupload")
                        break;
                    case "sm.ms":
                        api = "https://sm.ms/api/upload";
                        formData.append("smfile", file)
                        break;
                }
                new Promise((resove) => {
                    GM_xmlhttpRequest({
                        url: api,
                        method: "post",
                        data: formData,
                        onload: res => {
                            if (res.status == 200) {
                                switch (this.uploadApi) {
                                    case "niupic":
                                        resove(JSON.parse(res.responseText).img_puburl)
                                        break;
                                    case "catbox":
                                        resove(res.responseText)
                                        break;
                                    case "sm.ms":
                                        resove(JSON.parse(res.responseText).data.url)
                                        break;
                                }

                            } else {
                                resove('失败')
                            }
                        }
                    });
                }).then((url) => {
                    this.url[index] = url;
                    this.saveToLocal(this.url[index]);
                })
            },
            copyToClipboard(id) {
                let focus = document.getElementById(id);
                focus.select();
                document.execCommand("copy");
            },
            saveToLocal(url) {
                this.urlList.push(url);
                localStorage.setItem("imgUrl", JSON.stringify(this.urlList));
            },
            deleteThisImg(index) {
                this.urlList.splice(index, 1);
                localStorage.setItem("imgUrl", JSON.stringify(this.urlList));
            },

            dodrop(ev) {
                this.file = ev.dataTransfer.files
                this.url = []
            },
            pasteEvt(ev) {
                this.file = ev.clipboardData.files
                this.url = []
            },
            change(ev) {
                this.file = ev.target.files;
                this.url = []
            },
        },
        filters: {
            addHttp(url) {
                if (/^http(s)?/.test(url)) {
                    return url
                } else {
                    return "https://" + url
                }
            },
            addWithTag(url) {
                if (!url) return '在传了.....';
                return `[img]${url}[/img]`;
            },
        },
        mounted() {
            if (localStorage.getItem("imgUrl")) {
                this.urlList = JSON.parse(localStorage.getItem("imgUrl"));
            } else {
                localStorage.setItem("imgUrl", "[]");
            }
        }
    })


    const style = document.createElement("style");
    const heads = document.getElementsByTagName("head");
    style.setAttribute("type", "text/css");
    style.innerHTML = `
.imgupload-warp {
	position: fixed;
	width: 300px;
	padding: 15px;
	box-sizing: border-box;
	background-color: #eee;
	border-radius: 5px;
	box-shadow: 0 0 15px #aaa;
	z-index: 99;
}
.upload-layout {
	min-height: 100px;
	top: 93px;
	right: 60px;
}
.history-layout {
	height: 300px;
	right: 60px;
	top: 260px;
	overflow-y: scroll;
}
.history-layout img {
	height: 60px;
    vertical-align: middle;

}
.url-box {
	margin: 8px 0px;
}
.imgupload-toggle {
	position: fixed;
	height: 50px;
	width: 50px;
    font-size:12px;
	line-height: 48px;
	text-align: center;
	border-radius: 50%;
	background-color: #fff;
	opacity: 0.7;
	cursor: pointer;
	box-shadow: 0 0 15px #aaa;
	user-select: none;
	z-index: 99;
}
.imgupload-toggle:hover {
	opacity: 1;
}
.openUpload {
	top: 203px;
	right: 10px;
}
.openHistory {
	top: 260px;
	right: 10px;
}
.drop-area{
    min-height: 100px;
    white-space: nowrap;
    border: 1px solid black;
    padding:2px;
    background-color:#fff;
    font-size:10px;
    over-flow:hidden;
}
.img-history-list{
    display:flex;
    justify-content : space-between
}
.img-history-list:nth-of-type(2n+1){
    background-color:#fff;
}
.img-history-list:nth-of-type(2n){
    background-color:#ccc;
}
.warp-enter-active,
.warp-leave-active {
	transition: opacity 0.5s;
}
.warp-enter,
.warp-leave-to {
	opacity: 0;
}
`
    heads[0].append(style)
})();