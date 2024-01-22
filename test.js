const arr = [{ a: 1, b: '2' }, 3];
const obj = { c: 3, d: '4' };
arr[1] = obj;
obj.c = '阿里巴巴';
console.log(arr);
